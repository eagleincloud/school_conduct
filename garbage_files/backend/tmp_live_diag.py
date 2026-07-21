from django.utils import timezone

from attendance.models import Attendance, BiometricDevice, BiometricEventLog

print("NOW", timezone.now(), "LOCALDATE", timezone.localdate())

print("LATEST_EVENTS")
for event in BiometricEventLog.objects.order_by("-id")[:30]:
    print(
        event.id,
        event.received_at,
        event.punch_time,
        event.source_ip,
        event.device_serial_number,
        event.terminal_id,
        event.trans_id,
        event.event_type,
        event.user_identifier,
        event.status,
        event.error_message,
    )

print("TODAY_ATTENDANCE")
for attendance in Attendance.objects.select_related("student__user").filter(date=timezone.localdate()).order_by("-id")[:20]:
    print(
        attendance.id,
        attendance.student.user.name,
        attendance.student.rfid_code,
        attendance.status,
        attendance.verification_status,
        attendance.marked_via,
        attendance.punch_time,
    )

print("DEVICES")
for device in BiometricDevice.objects.order_by("-id")[:10]:
    print(
        device.id,
        device.name,
        device.device_serial_number,
        device.terminal_id,
        device.allowed_source_ip,
        device.last_seen_at,
        device.last_punch_at,
        device.last_event_type,
        device.last_test_status,
        device.last_tested_at,
        device.last_test_message,
    )
