from .models import Attendance
from communication.models import Notification

class AttendanceService:
    @staticmethod
    def mark_attendance(student_id, date, status, marked_by_id):
        attendance, created = Attendance.objects.update_or_create(
            student_id=student_id,
            date=date,
            defaults={'status': status, 'marked_by_id': marked_by_id}
        )
        return attendance, created
