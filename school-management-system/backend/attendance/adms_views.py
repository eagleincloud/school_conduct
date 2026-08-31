import datetime
import logging
import hashlib
import re
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.db.models import Q

from attendance.models import BiometricDevice, Attendance, TeacherAttendance, BiometricEventLog
from students.models import StudentProfile
from teachers.models import TeacherProfile

logger = logging.getLogger(__name__)

def _log_adms_debug(msg):
    try:
        with open("/opt/school-app/logs/adms-debug.log", "a") as f:
            f.write(f"[{datetime.datetime.now().isoformat()}] {msg}\n")
    except Exception:
        pass


def _parse_punch_datetime(time_str):
    """
    Tries multiple datetime formats common in biometric firmware.
    """
    if not time_str:
        return None
    time_str = time_str.strip()
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%d-%m-%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
    ]
    for fmt in formats:
        try:
            dt = datetime.datetime.strptime(time_str, fmt)
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt, timezone.get_current_timezone())
            return dt
        except ValueError:
            continue
    return None


def process_direct_punch(device, rfid_code, punch_dt):
    """
    Matches the student or teacher by RFID code / User ID / PIN
    and registers attendance and an audit event log.
    """
    school = device.school
    school_id = school.school_id if school else 'UNKNOWN'
    target_date = punch_dt.date()

    rfid_str = str(rfid_code).strip()
    if not rfid_str:
        return False

    # Extract clean numeric string (remove leading zeros)
    rfid_int_str = str(int(rfid_str)) if rfid_str.isdigit() else rfid_str

    matched = False
    student = None
    teacher = None
    student_att = None
    teacher_att = None

    # 1. Look up student in device school
    if school:
        student = StudentProfile.objects.select_related('class_section', 'user', 'school').filter(
            school=school
        ).filter(
            Q(rfid_code=rfid_str) | Q(rfid_code=rfid_int_str) |
            Q(user__username=rfid_str) | Q(user__username=rfid_int_str)
        ).first()

    if student:
        attendance, created = Attendance.objects.select_related('student').get_or_create(
            student=student,
            date=target_date,
            defaults={
                'status': 'present',
                'verification_status': 'approved',
                'marked_via': 'rfid',
                'punch_time': punch_dt,
                'class_section': student.class_section
            },
        )

        if not created:
            attendance.status = 'present'
            attendance.verification_status = 'approved'
            attendance.marked_via = 'rfid'
            attendance.punch_time = punch_dt
            attendance.save()

        student_att = attendance
        matched = True
        logger.info(f"[ADMS PUNCH SYNCED] Student {student.user.username} (RFID: {rfid_str}) at {punch_dt}")

    # 2. Look up teacher in device school
    if not matched and school:
        teacher = TeacherProfile.objects.select_related('user', 'school').filter(
            user__school=school
        ).filter(
            Q(rfid_code=rfid_str) | Q(rfid_code=rfid_int_str) |
            Q(user__username=rfid_str) | Q(user__username=rfid_int_str)
        ).first()

    if teacher:
        attendance, created = TeacherAttendance.objects.get_or_create(
            teacher=teacher,
            date=target_date,
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

        teacher_att = attendance
        matched = True
        logger.info(f"[ADMS PUNCH SYNCED] Teacher {teacher.user.username} (RFID: {rfid_str}) at {punch_dt}")

    # 3. Create or update BiometricEventLog
    fp_raw = f"adms|{device.device_serial_number}|{rfid_str}|{punch_dt.strftime('%Y%m%d%H%M%S')}"
    fingerprint = hashlib.sha256(fp_raw.encode()).hexdigest()

    try:
        BiometricEventLog.objects.update_or_create(
            event_fingerprint=fingerprint,
            defaults={
                'device': device,
                'school': school,
                'protocol': 'http',
                'status': 'processed' if matched else 'unmatched',
                'device_serial_number': device.device_serial_number,
                'event_type': 'TimeLog',
                'user_identifier': rfid_str,
                'punch_time': punch_dt,
                'attendance': student_att,
                'teacher_attendance': teacher_att,
                'error_message': '' if matched else f"User/RFID '{rfid_str}' not found in school {school_id}",
                'received_at': timezone.now(),
                'processed_at': timezone.now(),
            }
        )
    except Exception as exc:
        logger.error(f"[ADMS EVENTLOG ERROR] {exc}")

    return matched


@csrf_exempt
def adms_handshake_or_upload(request):
    """
    Handles GET /iclock/cdata (device handshake/initialization)
    and POST /iclock/cdata (data upload from machine)
    """
    serial_number = (
        request.GET.get('SN') or request.GET.get('sn') or
        request.POST.get('SN') or request.POST.get('sn') or ''
    ).strip()

    table = (request.GET.get('table') or request.POST.get('table') or '').strip()

    _log_adms_debug(f"{request.method} /iclock/cdata SN={serial_number} table={table}")

    if not serial_number:
        return HttpResponse("BAD SN", status=400)

    device = BiometricDevice.objects.select_related('school').filter(
        device_serial_number__iexact=serial_number,
        is_active=True
    ).first()

    if not device:
        logger.warning(f"[ADMS REJECTED] Active device with Serial Number '{serial_number}' not found.")
        return HttpResponse("UNAUTHORIZED DEVICE", status=401)

    now = timezone.now()
    client_ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()

    # ─── CASE 1: Device Init/Handshake (GET request) ───
    if request.method == 'GET':
        device.last_seen_at = now
        device.last_event_type = 'Handshake'
        device.last_test_status = 'online'
        device.last_test_message = 'eSSL/ADMS Handshake successful.'
        device.last_tested_at = now
        if client_ip:
            device.device_ip = client_ip
        device.save(update_fields=['last_seen_at', 'last_event_type', 'last_test_status', 'last_test_message', 'last_tested_at', 'device_ip'])

        # Register event log for handshake
        fp_raw = f"handshake|{serial_number}|{now.strftime('%Y%m%d%H%M')}"
        fingerprint = hashlib.sha256(fp_raw.encode()).hexdigest()
        try:
            BiometricEventLog.objects.update_or_create(
                event_fingerprint=fingerprint,
                defaults={
                    'device': device,
                    'school': device.school,
                    'protocol': 'http',
                    'status': 'received',
                    'device_serial_number': serial_number,
                    'event_type': 'Handshake',
                    'user_identifier': '',
                    'received_at': now,
                    'processed_at': now,
                }
            )
        except Exception:
            pass

        # Stamp=0 instructs the machine to upload all stored logs
        registry_response = (
            f"GET OPTION FROM: {serial_number}\n"
            "Stamp=0\n"
            "OpStamp=0\n"
            "PhotoStamp=0\n"
            "ErrorDelay=60\n"
            "Delay=10\n"
            "TransTimes=00:00;14:00\n"
            "TransInterval=1\n"
            "TransFlag=1111000000\n"
            "TimeZone=5.5\n"
            "Realtime=1\n"
            "Encrypt=0\n"
            "ServerVersion=2.4.1\n"
        )
        return HttpResponse(registry_response, content_type='text/plain')

    # ─── CASE 2: Upload Attendance Logs (POST request) ───
    elif request.method == 'POST':
        raw_body = request.body.decode('utf-8', errors='ignore')
        _log_adms_debug(f"POST body: {raw_body[:500]}")

        device.last_seen_at = now
        device.last_event_type = 'TimeLog'
        device.last_test_status = 'online'
        device.save(update_fields=['last_seen_at', 'last_event_type', 'last_test_status'])

        lines = [l.strip() for l in raw_body.splitlines() if l.strip()]
        synced_count = 0

        for line in lines:
            # Skip non-data header lines
            if line.lower().startswith(('stamp=', 'count=', 'opstamp=', 'table=')):
                continue

            rfid_code = None
            punch_dt = None

            # Format A: Key-Value style, e.g., PIN=1\tTIME=2026-08-31 17:05:46
            if 'PIN=' in line.upper() or 'TIME=' in line.upper():
                kv_pairs = re.findall(r'(\w+)=([^\t\r\n]+)', line)
                kv_dict = {k.upper(): v.strip() for k, v in kv_pairs}
                rfid_code = kv_dict.get('PIN') or kv_dict.get('USERID') or kv_dict.get('CARD')
                time_str = kv_dict.get('TIME') or kv_dict.get('TIMESTAMP')
                punch_dt = _parse_punch_datetime(time_str)

            # Format B: Delimited (Tab, Comma, or Space)
            if not rfid_code or not punch_dt:
                parts = line.split('\t') if '\t' in line else (line.split(',') if ',' in line else line.split())
                if len(parts) >= 2:
                    rfid_code = parts[0].strip()
                    # Check if date and time are separated into two fields (parts[1] and parts[2])
                    if len(parts) >= 3 and ('-' in parts[1] or '/' in parts[1]) and ':' in parts[2]:
                        time_str = f"{parts[1]} {parts[2]}"
                    else:
                        time_str = parts[1].strip()
                    punch_dt = _parse_punch_datetime(time_str)

            if rfid_code and punch_dt:
                device.last_punch_at = now
                device.save(update_fields=['last_punch_at'])
                if process_direct_punch(device, rfid_code, punch_dt):
                    synced_count += 1

        return HttpResponse("OK\n", content_type='text/plain')

    return HttpResponse("METHOD NOT ALLOWED", status=405)


@csrf_exempt
def adms_get_request(request):
    """
    Handles GET /iclock/getrequest (polling for remote commands / heartbeat)
    """
    serial_number = (
        request.GET.get('SN') or request.GET.get('sn') or
        request.POST.get('SN') or request.POST.get('sn') or ''
    ).strip()

    if not serial_number:
        return HttpResponse("BAD SN", status=400)

    now = timezone.now()
    device = BiometricDevice.objects.filter(
        device_serial_number__iexact=serial_number, is_active=True
    ).first()

    if device:
        device.last_seen_at = now
        device.last_event_type = 'KeepAlive'
        device.last_test_status = 'online'
        device.last_test_message = 'eSSL/ADMS Heartbeat received.'
        device.save(update_fields=['last_seen_at', 'last_event_type', 'last_test_status', 'last_test_message'])

        # Register event log for KeepAlive (deduplicated per 5 minutes)
        fp_raw = f"heartbeat|{serial_number}|{now.strftime('%Y%m%d%H%M')[:11]}"
        fingerprint = hashlib.sha256(fp_raw.encode()).hexdigest()
        try:
            BiometricEventLog.objects.update_or_create(
                event_fingerprint=fingerprint,
                defaults={
                    'device': device,
                    'school': device.school,
                    'protocol': 'http',
                    'status': 'received',
                    'device_serial_number': serial_number,
                    'event_type': 'KeepAlive',
                    'user_identifier': '',
                    'received_at': now,
                    'processed_at': now,
                }
            )
        except Exception:
            pass

    return HttpResponse("OK\n", content_type='text/plain')


@csrf_exempt
def adms_device_cmd(request):
    """
    Handles POST /iclock/devicecmd (command results from device)
    """
    serial_number = (request.GET.get('SN') or request.POST.get('SN') or '').strip()
    if serial_number:
        BiometricDevice.objects.filter(
            device_serial_number__iexact=serial_number, is_active=True
        ).update(
            last_seen_at=timezone.now(),
            last_test_status='online',
        )
    return HttpResponse("OK\n", content_type='text/plain')


@csrf_exempt
def adms_ping(request):
    """
    Simple ping endpoint for ADMS server reachability
    """
    return HttpResponse("OK\n", content_type='text/plain')
