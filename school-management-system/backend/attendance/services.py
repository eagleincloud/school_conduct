import hashlib
import logging
import re
from pathlib import Path
from datetime import datetime as datetime_type
from xml.etree import ElementTree

from django.db import IntegrityError, models, transaction
from django.utils import timezone

from students.models import StudentProfile
from teachers.models import TeacherProfile

from .models import Attendance, BiometricDevice, BiometricEventLog, TeacherAttendance

logger = logging.getLogger(__name__)
_BIOMETRIC_DEBUG_LOG = Path("/home/ec2-user/school-app/logs/biometric-debug.log")
_XML_OPENING_TAG = re.compile(
    r"<([A-Za-z_][A-Za-z0-9_.:-]*)(?:\s[^<>]*?)?\s*(/?)>",
    re.DOTALL,
)


class AttendanceService:
    @staticmethod
    def mark_attendance(student_id, date, status, marked_by_id):
        attendance, created = Attendance.objects.update_or_create(
            student_id=student_id,
            date=date,
            defaults={'status': status, 'marked_by_id': marked_by_id},
        )
        return attendance, created


def _strip_nul_chars(value):
    if isinstance(value, str):
        return value.replace("\x00", "")
    return value


def _sanitize_biometric_payload(value):
    if isinstance(value, dict):
        return {key: _sanitize_biometric_payload(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_sanitize_biometric_payload(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_sanitize_biometric_payload(item) for item in value)
    return _strip_nul_chars(value)


def extract_message_frames(buffer: str):
    """Extract complete XML documents from a streaming TCP buffer.

    The original listener only recognized ``<Message>`` documents. SBXPC
    firmware and callback versions can use other root element names and may
    prefix a document with an XML declaration or transport noise.
    """
    frames = []
    remainder = buffer

    while True:
        start = remainder.find("<")
        if start == -1:
            return frames, remainder[-2048:]

        if start:
            remainder = remainder[start:]

        document_start = 0
        root_start = 0
        if remainder.startswith("<?xml"):
            declaration_end = remainder.find("?>")
            if declaration_end == -1:
                return frames, remainder
            root_start = declaration_end + 2
            while root_start < len(remainder) and remainder[root_start].isspace():
                root_start += 1

        match = _XML_OPENING_TAG.match(remainder, root_start)
        if not match:
            # Keep an incomplete tag for the next socket read. For a complete
            # non-document token, advance one character and continue scanning.
            if ">" not in remainder[root_start:]:
                return frames, remainder[document_start:]
            remainder = remainder[root_start + 1 :]
            continue

        root_name = match.group(1)
        if match.group(2) == "/":
            end = match.end()
            frames.append(remainder[document_start:end])
            remainder = remainder[end:]
            continue

        closing_tag = f"</{root_name}>"
        end = remainder.lower().find(closing_tag.lower(), match.end())
        if end == -1:
            return frames, remainder[document_start:]

        end += len(closing_tag)
        frames.append(remainder[document_start:end])
        remainder = remainder[end:]


def _xml_local_name(tag: str):
    return tag.rsplit("}", 1)[-1].split(":", 1)[-1]


def _first_payload_value(payload: dict, *keys):
    for key in keys:
        value = payload.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def normalize_tcp_xml_event(payload: dict):
    """Normalize generic and SBXPC callback XML into School Conduct fields."""
    normalized = {str(key): _strip_nul_chars(value) for key, value in payload.items()}

    serial = _first_payload_value(
        normalized,
        "DeviceSerialNo",
        "DeviceUID",
        "DeviceUniqueID",
        "SerialNumber",
        "DeviceID",
    )
    if serial:
        normalized["DeviceSerialNo"] = serial

    terminal_id = _first_payload_value(
        normalized,
        "TerminalID",
        "TerminalId",
        "MachineID",
        "MachineId",
        "MachineNumber",
    )
    if terminal_id:
        normalized["TerminalID"] = terminal_id

    user_id = _first_payload_value(
        normalized,
        "UserID",
        "UserId",
        "EnrollNumber",
        "EnrollNo",
        "rfid_code",
    )
    if user_id:
        normalized["UserID"] = user_id

    event_type = _first_payload_value(normalized, "Event", "EventType", "event")
    compact_event_type = re.sub(r"[\s_-]+", "", event_type).lower()
    event_aliases = {
        "timelog": "TimeLog",
        "attendancelog": "TimeLog",
        "generallog": "TimeLog",
        "managementlog": "ManagementLog",
        "verificationfailure": "VerificationFailure",
        "verificationsuccess": "VerificationSuccess",
        "alarmon": "AlarmOn",
        "alarmoff": "AlarmOff",
        "doorbell": "DoorBell",
    }
    if event_type:
        normalized["Event"] = event_aliases.get(compact_event_type, event_type.strip())

    attendance_status = _first_payload_value(
        normalized, "AttendStat", "AttendanceStatus", "IOStatus", "io_mode"
    )
    if attendance_status:
        normalized["AttendStat"] = attendance_status

    verification_mode = _first_payload_value(
        normalized, "VerifMode", "VerificationMode", "VerifyMode", "verify_mode"
    )
    if verification_mode:
        normalized["VerifMode"] = verification_mode

    return normalized


def parse_tcp_xml_payload(raw_payload: str):
    root = ElementTree.fromstring(raw_payload.strip())
    payload = {}
    for child in root.iter():
        if child is root or len(child):
            continue
        payload[_xml_local_name(child.tag)] = (child.text or "").strip()
    return normalize_tcp_xml_event(payload)


def _normalize_target_type(value):
    normalized = (value or "").strip().lower()
    if normalized in {"student", "teacher"}:
        return normalized
    return ""


def _parse_punch_time(payload):
    punch_time_raw = payload.get('punch_time') or payload.get('PunchTime')
    if punch_time_raw:
        try:
            punch_dt = datetime_type.strptime(str(punch_time_raw), "%Y-%m-%d %H:%M:%S")
            if timezone.is_naive(punch_dt):
                punch_dt = timezone.make_aware(punch_dt, timezone.get_current_timezone())
            return punch_dt
        except Exception:
            pass

    year = payload.get('Year')
    month = payload.get('Month')
    day = payload.get('Day')
    hour = payload.get('Hour', '0')
    minute = payload.get('Minute', '0')
    second = payload.get('Second', '0')
    if year and month and day:
        try:
            punch_dt = datetime_type(
                int(year),
                int(month),
                int(day),
                int(hour or 0),
                int(minute or 0),
                int(second or 0),
            )
            return timezone.make_aware(punch_dt, timezone.get_current_timezone())
        except Exception:
            pass

    return timezone.now()


def compute_event_fingerprint(protocol: str, payload: dict):
    def value(*keys):
        return _first_payload_value(payload, *keys)

    base = "|".join(
        [
            str(protocol or '').strip().lower(),
            value('DeviceSerialNo', 'device_serial_number', 'DeviceUID'),
            value('TerminalID', 'terminal_id', 'MachineID'),
            value('Event', 'event'),
            value('TransID', 'trans_id'),
            value('UserID', 'rfid_code'),
            value('VerifMode', 'VerificationMode', 'VerifyMode', 'verify_mode'),
            value('AttendStat', 'AttendanceStatus', 'IOStatus', 'io_mode'),
            value('punch_time', 'PunchTime'),
            value('Year'),
            value('Month'),
            value('Day'),
            value('Hour'),
            value('Minute'),
            value('Second'),
        ]
    )
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def _legacy_event_fingerprints(protocol: str, payload: dict):
    """Return fingerprints emitted before verification details were added.

    Keeping a compatibility lookup prevents a terminal replay from inserting
    one fresh copy of every historical punch immediately after deployment.
    """
    serial = str(
        payload.get('DeviceSerialNo', '') or payload.get('device_serial_number', '') or ''
    )
    terminal_id = str(payload.get('TerminalID', '') or payload.get('MachineID', '') or '')
    suffix = [
        str(payload.get('Event', '') or payload.get('event', '') or ''),
        str(payload.get('TransID', '') or payload.get('trans_id', '') or ''),
        str(payload.get('UserID', '') or payload.get('rfid_code', '') or ''),
        str(payload.get('punch_time', '') or ''),
        str(payload.get('Year', '') or ''),
        str(payload.get('Month', '') or ''),
        str(payload.get('Day', '') or ''),
        str(payload.get('Hour', '') or ''),
        str(payload.get('Minute', '') or ''),
        str(payload.get('Second', '') or ''),
    ]

    fingerprints = []
    if serial or terminal_id:
        with_terminal = "|".join([str(protocol), serial, terminal_id, *suffix])
        fingerprints.append(hashlib.sha256(with_terminal.encode("utf-8")).hexdigest())
    if serial:
        without_terminal = "|".join([str(protocol), serial, *suffix])
        fingerprints.append(hashlib.sha256(without_terminal.encode("utf-8")).hexdigest())
    return fingerprints


def _legacy_event_matches_verification_details(event_log, payload: dict):
    incoming_mode = _first_payload_value(
        payload, 'VerifMode', 'VerificationMode', 'VerifyMode', 'verify_mode'
    ).casefold()
    incoming_status = _first_payload_value(
        payload, 'AttendStat', 'AttendanceStatus', 'IOStatus', 'io_mode'
    ).casefold()
    stored_mode = str(event_log.verify_mode or '').strip().casefold()
    stored_status = str(event_log.attend_stat or '').strip().casefold()
    mode_matches = not incoming_mode or not stored_mode or incoming_mode == stored_mode
    status_matches = not incoming_status or not stored_status or incoming_status == stored_status
    return mode_matches and status_matches


def _find_existing_event_log(protocol: str, payload: dict, fingerprint: str):
    existing = BiometricEventLog.objects.filter(event_fingerprint=fingerprint).first()
    if existing:
        return existing

    serial = _first_payload_value(payload, 'DeviceSerialNo', 'device_serial_number')
    terminal_id = _first_payload_value(payload, 'TerminalID', 'terminal_id', 'MachineID')
    event_type = _first_payload_value(payload, 'Event', 'event')
    trans_id = _first_payload_value(payload, 'TransID', 'trans_id')
    user_identifier = _first_payload_value(payload, 'UserID', 'rfid_code')
    verify_mode = _first_payload_value(
        payload, 'VerifMode', 'VerificationMode', 'VerifyMode', 'verify_mode'
    )
    attend_stat = _first_payload_value(
        payload, 'AttendStat', 'AttendanceStatus', 'IOStatus', 'io_mode'
    )
    has_device_timestamp = bool(
        _first_payload_value(payload, 'punch_time', 'PunchTime')
        or all(_first_payload_value(payload, key) for key in ('Year', 'Month', 'Day'))
    )
    if serial and event_type and user_identifier and has_device_timestamp:
        semantic_match = BiometricEventLog.objects.filter(
            protocol=protocol,
            device_serial_number__iexact=serial,
            event_type__iexact=event_type,
            user_identifier=user_identifier,
            punch_time=_parse_punch_time(payload),
        )
        if terminal_id:
            semantic_match = semantic_match.filter(terminal_id=terminal_id)
        if trans_id:
            semantic_match = semantic_match.filter(trans_id=trans_id)
        if verify_mode:
            semantic_match = semantic_match.filter(verify_mode__iexact=verify_mode)
        if attend_stat:
            semantic_match = semantic_match.filter(attend_stat__iexact=attend_stat)
        existing = semantic_match.order_by('id').first()
        if existing:
            return existing

    for legacy_fingerprint in _legacy_event_fingerprints(protocol, payload):
        existing = BiometricEventLog.objects.filter(event_fingerprint=legacy_fingerprint).first()
        if existing and _legacy_event_matches_verification_details(existing, payload):
            return existing
    return None


def resolve_tcp_device(payload: dict, source_ip: str | None = None):
    return resolve_direct_push_device(
        payload,
        source_ip=source_ip,
        integration_modes=('tcp_xml_push',),
        lookup_label='TCP XML',
    )


def resolve_direct_push_device(
    payload: dict,
    *,
    source_ip: str | None = None,
    integration_modes=('tcp_xml_push', 'http_push'),
    lookup_label='direct push',
):
    serial = (payload.get('DeviceSerialNo') or "").strip()
    terminal_id = (
        payload.get('TerminalID')
        or payload.get('MachineID')
        or payload.get('MachineId')
        or ""
    ).strip()

    device = None
    if serial:
        device = (
            BiometricDevice.objects.select_related('school')
            .filter(
                integration_mode__in=integration_modes,
                device_serial_number__iexact=serial,
                is_active=True,
            )
            .first()
        )

    # Fallback for devices whose reported serial is unreliable. TerminalID is not
    # globally unique, so require a source-IP allowlist before trusting it.
    if not device and terminal_id and source_ip:
        device = (
            BiometricDevice.objects.select_related('school')
            .filter(
                integration_mode__in=integration_modes,
                terminal_id=terminal_id,
                allowed_source_ip=source_ip,
                is_active=True,
            )
            .first()
        )

    if not device:
        identity = f"serial {serial}" if serial else "missing serial"
        if terminal_id:
            identity = f"{identity}, terminal {terminal_id}"
        raise LookupError(f"No active {lookup_label} biometric device is registered for {identity}.")

    if device.allowed_source_ip and source_ip and device.allowed_source_ip != source_ip:
        raise PermissionError(
            f"Source IP {source_ip} is not allowed for device serial {serial}. Expected {device.allowed_source_ip}."
        )

    if terminal_id and device.terminal_id and str(device.terminal_id).strip() != terminal_id:
        raise PermissionError(
            f"Terminal ID mismatch for serial {serial}. Received {terminal_id}, expected {device.terminal_id}."
        )

    return device


def resolve_http_device(payload: dict, api_key: str | None):
    school_id = payload.get('school_id')
    if not school_id:
        raise ValueError("school_id is required.")

    device = (
        BiometricDevice.objects.select_related('school')
        .filter(
            school__school_id=school_id,
            device_secret_key=api_key,
            is_active=True,
        )
        .first()
    )
    if not device:
        raise PermissionError("Invalid device token or school mismatch.")
    return device


def _resolve_student(identifier: str, school_id: str):
    if not identifier:
        return None
    return (
        StudentProfile.objects.select_related('class_section', 'user', 'school')
        .filter(school__school_id=school_id)
        .filter(
            models.Q(rfid_code=identifier)
            | models.Q(admission_number=identifier)
            | models.Q(roll_number=identifier)
            | models.Q(user__username=identifier)
        )
        .first()
    )


def _resolve_teacher(identifier: str, school_id: str):
    if not identifier:
        return None
    return (
        TeacherProfile.objects.select_related('user', 'school')
        .filter(school__school_id=school_id)
        .filter(
            models.Q(rfid_code=identifier)
            | models.Q(employee_id=identifier)
            | models.Q(user__username=identifier)
        )
        .first()
    )


def _process_teacher_attendance(teacher, punch_dt):
    attendance, created = TeacherAttendance.objects.get_or_create(
        teacher=teacher,
        date=punch_dt.date(),
        defaults={
            'status': 'present',
            'marked_via': 'rfid',
            'punch_in_time': punch_dt,
        },
    )
    if not created:
        if not attendance.punch_out_time or attendance.punch_out_time < punch_dt:
            attendance.punch_out_time = punch_dt
            attendance.save(update_fields=['punch_out_time'])
        message = 'Punch-out recorded'
    else:
        message = 'Punch-in recorded successfully'
    return attendance, created, message


def _process_student_attendance(student, punch_dt):
    attendance, created = Attendance.objects.select_related('student').get_or_create(
        student=student,
        date=punch_dt.date(),
        defaults={
            'status': 'present',
            'verification_status': 'approved',
            'marked_via': 'rfid',
            'punch_time': punch_dt,
            'class_section': student.class_section,
        },
    )

    if not created and attendance.verification_status == 'approved' and attendance.status in ('present', 'late'):
        if not attendance.punch_time or attendance.punch_time < punch_dt:
            attendance.punch_time = punch_dt
            attendance.save(update_fields=['punch_time'])
        message = 'Punch received: attendance already approved'
        return attendance, created, message

    if not created:
        if attendance.status == 'absent' or attendance.verification_status == 'rejected':
            attendance.status = 'present'
            attendance.verification_status = 'approved'
            attendance.marked_via = 'rfid'
            attendance.punch_time = punch_dt
            attendance.class_section = student.class_section
            attendance.marked_by = None
            attendance.verified_by = None
            attendance.verified_at = timezone.now()
            attendance.save()
            message = 'Punch processed and attendance marked present'
        else:
            attendance.status = 'present'
            attendance.verification_status = 'approved'
            attendance.marked_via = 'rfid'
            attendance.punch_time = punch_dt
            attendance.class_section = student.class_section
            attendance.marked_by = None
            attendance.verified_by = None
            attendance.verified_at = timezone.now()
            attendance.save()
            message = 'Punch processed successfully'
    else:
        attendance.status = 'present'
        attendance.verification_status = 'approved'
        attendance.marked_via = 'rfid'
        attendance.punch_time = punch_dt
        attendance.class_section = student.class_section
        attendance.marked_by = None
        attendance.verified_by = None
        attendance.verified_at = timezone.now()
        attendance.save()
        message = 'Punch processed successfully'

    return attendance, created, message


def _base_event_log_kwargs(device, protocol, source_ip, payload, raw_payload, punch_dt, fingerprint):
    return {
        'device': device,
        'school': device.school if device else None,
        'protocol': protocol,
        'status': 'received',
        'event_fingerprint': fingerprint,
        'source_ip': source_ip,
        'device_serial_number': (payload.get('DeviceSerialNo') or payload.get('device_serial_number') or '').strip(),
        'terminal_id': (payload.get('TerminalID') or payload.get('terminal_id') or '').strip(),
        'trans_id': (payload.get('TransID') or payload.get('trans_id') or '').strip(),
        'event_type': (payload.get('Event') or payload.get('event') or '').strip(),
        'user_identifier': str(payload.get('UserID') or payload.get('rfid_code') or '').strip(),
        'attend_stat': (payload.get('AttendStat') or '').strip(),
        'verify_mode': (payload.get('VerifMode') or '').strip(),
        'punch_time': punch_dt,
        'raw_payload': raw_payload,
        'normalized_payload': payload,
    }


def _log_nul_bytes_in_event_kwargs(kwargs):
    def contains_nul(value):
        if isinstance(value, str):
            return "\x00" in value
        if isinstance(value, bytes):
            return b"\x00" in value
        if isinstance(value, dict):
            return any(contains_nul(key) or contains_nul(item) for key, item in value.items())
        if isinstance(value, (list, tuple)):
            return any(contains_nul(item) for item in value)
        return False

    def walk(value, path):
        if isinstance(value, str):
            if "\x00" in value:
                logger.error("NUL byte detected at %s: %r", path, value)
            return
        if isinstance(value, bytes):
            if b"\x00" in value:
                logger.error("NUL byte detected at %s: %r", path, value)
            return
        if isinstance(value, dict):
            for key, item in value.items():
                walk(key, f"{path}[key]")
                walk(item, f"{path}.{key}")
            return
        if isinstance(value, (list, tuple)):
            for index, item in enumerate(value):
                walk(item, f"{path}[{index}]")

    for key, value in kwargs.items():
        try:
            if contains_nul(value):
                logger.error("NUL byte detected in BiometricEventLog field '%s' (type=%s)", key, type(value).__name__)
                walk(value, key)
        except Exception as exc:
            logger.error("Failed while checking field '%s' for NUL bytes: %s", key, exc)


def _write_biometric_debug_snapshot(label, kwargs):
    try:
        lines = [f"[{label}]"]
        for key, value in kwargs.items():
            lines.append(f"{key}: type={type(value).__name__} repr={value!r}")
        lines.append("")
        _BIOMETRIC_DEBUG_LOG.parent.mkdir(parents=True, exist_ok=True)
        with _BIOMETRIC_DEBUG_LOG.open("a", encoding="utf-8") as handle:
            handle.write("\n".join(lines))
    except Exception:
        pass


@transaction.atomic
def process_biometric_event(
    *,
    protocol: str,
    payload: dict,
    raw_payload: str = "",
    source_ip: str | None = None,
    api_key: str | None = None,
    device: BiometricDevice | None = None,
):
    payload = _sanitize_biometric_payload(dict(payload))
    raw_payload = _strip_nul_chars(raw_payload or "")
    if protocol == 'http' and payload.get('rfid_code') and not (payload.get('Event') or payload.get('event')):
        payload['Event'] = 'TimeLog'

    fingerprint = compute_event_fingerprint(protocol, payload)
    existing = _find_existing_event_log(protocol, payload, fingerprint)
    if existing:
        try:
            if device:
                pass
            elif protocol == 'tcp_xml':
                device = resolve_tcp_device(payload, source_ip=source_ip)
            elif protocol == 'http':
                device = resolve_http_device(payload, api_key=api_key)
            else:
                device = None
        except Exception:
            device = None

        if device:
            event_type = (payload.get('Event') or payload.get('event') or existing.event_type or 'Punch').strip()
            device.last_seen_at = timezone.now()
            device.last_event_type = event_type[:50]
            device.last_test_status = 'online'
            device.save(update_fields=['last_seen_at', 'last_event_type', 'last_test_status'])

            update_fields = []
            if existing.device_id != device.id:
                existing.device = device
                existing.school = device.school
                update_fields.extend(['device', 'school'])
            if update_fields:
                existing.save(update_fields=update_fields)

            event_type = (payload.get('Event') or payload.get('event') or existing.event_type or '').strip()
            user_identifier = str(payload.get('UserID') or payload.get('rfid_code') or existing.user_identifier or '').strip()
            if event_type.lower() == 'timelog' and user_identifier:
                punch_dt = existing.punch_time or _parse_punch_time(payload)
                school_id = device.school.school_id
                student = _resolve_student(user_identifier, school_id)
                if student:
                    attendance, _created, _message = _process_student_attendance(student, punch_dt)
                    existing.status = 'processed'
                    existing.attendance = attendance
                    existing.processed_at = timezone.now()
                    existing.save(update_fields=['status', 'attendance', 'processed_at'])

                    if not device.last_punch_at or device.last_punch_at < punch_dt:
                        device.last_punch_at = punch_dt
                        device.save(update_fields=['last_punch_at'])

                    return {
                        'ok': True,
                        'status': 'processed',
                        'device_authorized': True,
                        'message': 'Duplicate biometric event reapplied to student attendance.',
                        'target_type': 'student',
                        'student_name': student.user.name or student.user.username,
                        'school_name': student.school.name if student.school else '',
                        'punch_time': attendance.punch_time.isoformat() if attendance.punch_time else punch_dt.isoformat(),
                        'event_log_id': existing.id,
                    }

                teacher = _resolve_teacher(user_identifier, school_id)
                if teacher:
                    teacher_attendance, _created, message = _process_teacher_attendance(teacher, punch_dt)
                    existing.status = 'processed'
                    existing.teacher_attendance = teacher_attendance
                    existing.processed_at = timezone.now()
                    existing.save(update_fields=['status', 'teacher_attendance', 'processed_at'])

                    if not device.last_punch_at or device.last_punch_at < punch_dt:
                        device.last_punch_at = punch_dt
                        device.save(update_fields=['last_punch_at'])

                    return {
                        'ok': True,
                        'status': 'processed',
                        'device_authorized': True,
                        'message': f'Duplicate biometric event reapplied to teacher attendance. {message}',
                        'target_type': 'teacher',
                        'teacher_name': teacher.user.name or teacher.user.username,
                        'school_name': teacher.school.name if teacher.school else '',
                        'punch_in_time': teacher_attendance.punch_in_time.isoformat() if teacher_attendance.punch_in_time else None,
                        'punch_out_time': teacher_attendance.punch_out_time.isoformat() if teacher_attendance.punch_out_time else None,
                        'event_log_id': existing.id,
                    }

        return {
            'ok': True,
            'status': 'duplicate',
            'device_authorized': bool(device),
            'message': 'Duplicate biometric event ignored.',
            'event_log_id': existing.id,
        }

    punch_dt = _parse_punch_time(payload)

    try:
        if device:
            pass
        elif protocol == 'tcp_xml':
            device = resolve_tcp_device(payload, source_ip=source_ip)
        elif protocol == 'http':
            device = resolve_http_device(payload, api_key=api_key)
        else:
            raise ValueError(f"Unsupported protocol {protocol}.")
    except Exception as exc:
        event_log_kwargs = _base_event_log_kwargs(
            None,
            protocol,
            source_ip,
            payload,
            raw_payload,
            punch_dt,
            fingerprint,
        )
        event_log_kwargs.update(
            {
                'status': 'unauthorized',
                'error_message': str(exc)[:255],
                'processed_at': timezone.now(),
            }
        )
        _log_nul_bytes_in_event_kwargs(event_log_kwargs)
        _write_biometric_debug_snapshot("unauthorized-before-create", event_log_kwargs)
        try:
            event_log = BiometricEventLog.objects.create(
                **event_log_kwargs,
            )
        except IntegrityError:
            existing = BiometricEventLog.objects.filter(event_fingerprint=fingerprint).first()
            if existing:
                return {
                    'ok': False,
                    'status': 'unauthorized',
                    'device_authorized': False,
                    'message': 'Duplicate unauthorized biometric event ignored.',
                    'event_log_id': existing.id,
                }
            raise
        logger.warning("Rejected biometric event: %s", exc)
        return {
            'ok': False,
            'status': 'unauthorized',
            'device_authorized': False,
            'message': str(exc),
            'event_log_id': event_log.id,
        }

    try:
        event_log_kwargs = _base_event_log_kwargs(
            device, protocol, source_ip, payload, raw_payload, punch_dt, fingerprint
        )
        _log_nul_bytes_in_event_kwargs(event_log_kwargs)
        _write_biometric_debug_snapshot("before-create", event_log_kwargs)
        event_log = BiometricEventLog.objects.create(**event_log_kwargs)
    except IntegrityError:
        existing = BiometricEventLog.objects.filter(event_fingerprint=fingerprint).first()
        if existing:
            return {
                'ok': True,
                'status': 'duplicate',
                'device_authorized': True,
                'message': 'Duplicate biometric event ignored.',
                'event_log_id': existing.id,
            }
        raise

    event_type = (payload.get('Event') or '').strip() or 'Punch'
    device.last_seen_at = timezone.now()
    device.last_event_type = event_type[:50]
    device.last_test_status = 'online'
    device.last_test_message = f"Received {event_type} over {protocol}."
    update_fields = ['last_seen_at', 'last_event_type', 'last_test_status', 'last_test_message']

    user_identifier = str(payload.get('UserID') or payload.get('rfid_code') or '').strip()
    target_type = _normalize_target_type(payload.get('target_type'))

    if event_type.lower() != 'timelog':
        device.save(update_fields=update_fields)
        event_log.status = 'ignored'
        event_log.processed_at = timezone.now()
        event_log.save(update_fields=['status', 'processed_at'])
        return {
            'ok': True,
            'status': 'ignored',
            'device_authorized': True,
            'message': f'Ignored non-attendance event {event_type}.',
            'event_log_id': event_log.id,
        }

    if not user_identifier:
        event_log.status = 'failed'
        event_log.error_message = 'User identifier missing from biometric payload.'
        event_log.processed_at = timezone.now()
        event_log.save(update_fields=['status', 'error_message', 'processed_at'])
        return {
            'ok': False,
            'status': 'failed',
            'device_authorized': True,
            'message': event_log.error_message,
            'event_log_id': event_log.id,
        }

    school_id = device.school.school_id
    student = None
    teacher = None

    if not target_type:
        student = _resolve_student(user_identifier, school_id)
        if student:
            target_type = 'student'
        else:
            teacher = _resolve_teacher(user_identifier, school_id)
            if teacher:
                target_type = 'teacher'
    elif target_type == 'student':
        student = _resolve_student(user_identifier, school_id)
    elif target_type == 'teacher':
        teacher = _resolve_teacher(user_identifier, school_id)

    if target_type == 'student' and not student:
        event_log.status = 'unmatched'
        event_log.error_message = f'Student identifier {user_identifier} was not found for school {school_id}.'
        event_log.processed_at = timezone.now()
        event_log.save(update_fields=['status', 'error_message', 'processed_at'])
        return {
            'ok': False,
            'status': 'unmatched',
            'device_authorized': True,
            'message': event_log.error_message,
            'event_log_id': event_log.id,
        }

    if target_type == 'teacher' and not teacher:
        event_log.status = 'unmatched'
        event_log.error_message = f'Teacher identifier {user_identifier} was not found for school {school_id}.'
        event_log.processed_at = timezone.now()
        event_log.save(update_fields=['status', 'error_message', 'processed_at'])
        return {
            'ok': False,
            'status': 'unmatched',
            'device_authorized': True,
            'message': event_log.error_message,
            'event_log_id': event_log.id,
        }

    if not target_type:
        event_log.status = 'unmatched'
        event_log.error_message = f'Identifier {user_identifier} did not match any student or teacher in school {school_id}.'
        event_log.processed_at = timezone.now()
        event_log.save(update_fields=['status', 'error_message', 'processed_at'])
        return {
            'ok': False,
            'status': 'unmatched',
            'device_authorized': True,
            'message': event_log.error_message,
            'event_log_id': event_log.id,
        }

    if target_type == 'teacher':
        teacher_attendance, created, message = _process_teacher_attendance(teacher, punch_dt)
        device.last_punch_at = punch_dt
        update_fields.append('last_punch_at')
        device.save(update_fields=update_fields)
        event_log.status = 'processed'
        event_log.teacher_attendance = teacher_attendance
        event_log.processed_at = timezone.now()
        event_log.save(update_fields=['status', 'teacher_attendance', 'processed_at'])
        return {
            'ok': True,
            'status': 'processed',
            'device_authorized': True,
            'message': message,
            'target_type': 'teacher',
            'teacher_name': teacher.user.name or teacher.user.username,
            'school_name': teacher.school.name if teacher.school else '',
            'punch_in_time': teacher_attendance.punch_in_time.isoformat() if teacher_attendance.punch_in_time else None,
            'punch_out_time': teacher_attendance.punch_out_time.isoformat() if teacher_attendance.punch_out_time else None,
            'event_log_id': event_log.id,
        }

    attendance, created, message = _process_student_attendance(student, punch_dt)
    device.last_punch_at = punch_dt
    update_fields.append('last_punch_at')
    device.save(update_fields=update_fields)
    event_log.status = 'processed'
    event_log.attendance = attendance
    event_log.processed_at = timezone.now()
    event_log.save(update_fields=['status', 'attendance', 'processed_at'])
    return {
        'ok': True,
        'status': 'processed',
        'device_authorized': True,
        'message': message,
        'target_type': 'student',
        'student_name': student.user.name or student.user.username,
        'school_name': student.school.name if student.school else '',
        'punch_time': attendance.punch_time.isoformat() if attendance.punch_time else punch_dt.isoformat(),
        'event_log_id': event_log.id,
    }
