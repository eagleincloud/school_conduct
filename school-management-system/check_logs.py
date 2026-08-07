from attendance.models import Attendance, BiometricEventLog, TeacherAttendance
import sys

def check_logs(count=20):
    if len(sys.argv) > 1:
        try:
            count = int(sys.argv[1])
        except ValueError:
            pass
            
    print(f"--- FETCHING LAST {count} RAW MACHINE LOGS ---")
    logs = BiometricEventLog.objects.all().order_by('-received_at')[:count]
    
    for log in logs:
        device_name = log.device.name if log.device else "Unknown Device"
        time_str = log.received_at.strftime("%Y-%m-%d %H:%M:%S")
        serial = log.device_serial_number or "N/A"
        proto = log.protocol or "N/A"
        print(f"[{time_str}] ID:{log.id} | User:{log.user_identifier} | Proto:{proto} | Serial:{serial} | Status:{log.status} | PunchTime:{log.punch_time} | Fingerprint:{log.event_fingerprint[:12]}...")

    print("\n--- STUDENT ATTENDANCE CREATED TODAY ---")
    for att in Attendance.objects.order_by('-id')[:10]:
        print(f"ID:{att.id} | Student:{att.student} (RFID:{att.student.rfid_code}) | Date:{att.date} | Status:{att.status} | PunchTime:{att.punch_time}")

    print("\n--- TEACHER ATTENDANCE CREATED TODAY ---")
    for tatt in TeacherAttendance.objects.order_by('-id')[:10]:
        print(f"ID:{tatt.id} | Teacher:{tatt.teacher} (RFID:{tatt.teacher.rfid_code}) | Date:{tatt.date} | Status:{tatt.status} | PunchIn:{tatt.punch_in_time} | PunchOut:{tatt.punch_out_time}")

if __name__ == "__main__":
    check_logs()
