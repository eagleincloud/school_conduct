import datetime
import logging
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone

from attendance.models import BiometricDevice, Attendance, TeacherAttendance
from students.models import StudentProfile
from teachers.models import TeacherProfile
from communication.models import Notification

logger = logging.getLogger(__name__)

def process_direct_punch(device, rfid_code, punch_dt):
    """
    Core punch processing logic. Matches the student/teacher by RFID code 
    and registers attendance appropriately.
    """
    school = device.school
    school_id = school.school_id
    target_date = punch_dt.date()

    # 1. Look up student in this school
    student = StudentProfile.objects.select_related('class_section', 'user', 'school').filter(
        rfid_code=rfid_code,
        school=school
    ).first()

    if student:
        # Create or update student attendance (pending verification)
        attendance, created = Attendance.objects.select_related('student').get_or_create(
            student=student,
            date=target_date,
            defaults={
                'status': 'present',
                'verification_status': 'pending',
                'marked_via': 'rfid',
                'punch_time': punch_dt,
                'class_section': student.class_section
            },
        )

        if not created and attendance.verification_status != 'pending':
            # Override if marked absent or rejected, since physical scan overrides it to pending
            if attendance.status == 'absent' or attendance.verification_status == 'rejected':
                attendance.status = 'present'
                attendance.verification_status = 'pending'
                attendance.marked_via = 'rfid'
                attendance.punch_time = punch_dt
                attendance.marked_by = None
                attendance.verified_by = None
                attendance.verified_at = None
                attendance.save()
        elif not created:
            # Update punch time for existing pending logs
            attendance.status = 'present'
            attendance.verification_status = 'pending'
            attendance.marked_via = 'rfid'
            attendance.punch_time = punch_dt
            attendance.class_section = student.class_section
            attendance.marked_by = None
            attendance.verified_by = None
            attendance.verified_at = None
            attendance.save()

        # Notify Class Teacher
        if created:
            class_section = student.class_section
            if class_section and class_section.class_teacher:
                teacher_user = class_section.class_teacher.user
                Notification.objects.create(
                    user=teacher_user,
                    target_role=teacher_user.role,
                    title='Attendance Verification Pending',
                    message=f"{student.user.name or student.user.username} punched attendance for {target_date.isoformat()}. Please verify (Approve/Reject).",
                    is_read=False,
                )
        
        logger.info(f"[ADMS PUNCH SYNCED] Student {student.user.username} (RFID: {rfid_code}) at {punch_dt}")
        return True

    # 2. Look up teacher in this school
    teacher = TeacherProfile.objects.select_related('user', 'school').filter(
        rfid_code=rfid_code,
        user__school=school
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
        
        logger.info(f"[ADMS PUNCH SYNCED] Teacher {teacher.user.username} (RFID: {rfid_code}) at {punch_dt}")
        return True

    logger.warning(f"[ADMS PUNCH UNMATCHED] RFID {rfid_code} not found in school {school_id}")
    return False


@csrf_exempt
def adms_handshake_or_upload(request):
    """
    Handles GET /iclock/cdata (device handshake/initialization)
    and POST /iclock/cdata (data upload from machine)
    """
    serial_number = request.GET.get('SN')
    table = request.GET.get('table')

    if not serial_number:
        return HttpResponse("BAD SN")

    # Resolve device by Serial Number
    device = BiometricDevice.objects.select_related('school').filter(
        serial_number=serial_number,
        is_active=True
    ).first()

    if not device:
        logger.warning(f"[ADMS REJECTED] Active device with Serial Number '{serial_number}' not found.")
        return HttpResponse("UNAUTHORIZED DEVICE")

    now = timezone.now()
    device.last_seen_at = now
    
    # ─── CASE 1: Device Init/Handshake (GET request) ───
    if request.method == 'GET':
        device.last_test_status = 'online'
        device.last_test_message = 'ADMS Handshake successful.'
        device.last_tested_at = now
        device.save(update_fields=['last_seen_at', 'last_test_status', 'last_test_message', 'last_tested_at'])
        
        # Standard configuration registry response for ZK/Realtime devices
        registry_response = (
            "RegistryCode=\n"
            "Delay=10\n"
            "TransTimes=00:00;14:00\n"
            "TransInterval=10\n"
            "TransFlag=1111111111\n"
            "TimeZone=8\n"
            "Realtime=1\n"
        )
        return HttpResponse(registry_response, content_type='text/plain')

    # ─── CASE 2: Upload Attendance Logs (POST request) ───
    elif request.method == 'POST':
        device.last_punch_at = now
        device.save(update_fields=['last_seen_at', 'last_punch_at'])

        if table == 'ATTLOG':
            raw_data = request.body.decode('utf-8')
            lines = raw_data.split('\n')
            
            synced_count = 0
            for line in lines:
                parts = line.strip().split()
                if len(parts) < 3:
                    continue
                
                rfid_code = parts[0]
                timestamp_str = f"{parts[1]} {parts[2]}"
                
                try:
                    punch_dt = datetime.datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                    if timezone.is_naive(punch_dt):
                        punch_dt = timezone.make_aware(punch_dt, timezone.get_current_timezone())
                except Exception as parse_err:
                    logger.error(f"[ADMS PARSE ERROR] Failed parsing punch log timestamp: {parse_err}")
                    continue

                if process_direct_punch(device, rfid_code, punch_dt):
                    synced_count += 1

            # GB_OK indicates to the machine that logs are parsed and can be cleared/flagged as uploaded
            return HttpResponse(f"GB_OK\n{synced_count}", content_type='text/plain')
        
        return HttpResponse("OK", content_type='text/plain')

    return HttpResponse("METHOD NOT ALLOWED", status=405)


@csrf_exempt
def adms_get_request(request):
    """
    Handles GET /iclock/getrequest (polling for remote commands)
    """
    serial_number = request.GET.get('SN')
    if not serial_number:
        return HttpResponse("BAD SN")

    # Update heartbeat
    BiometricDevice.objects.filter(serial_number=serial_number, is_active=True).update(last_seen_at=timezone.now())
    
    # We do not push remote commands currently, so always return OK to complete the poll cycle
    return HttpResponse("OK", content_type='text/plain')
