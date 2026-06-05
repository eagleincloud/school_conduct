from .models import StudentProfile
from accounts.models import User

class StudentService:
    @staticmethod
    def get_student_by_id(student_id):
        return StudentProfile.objects.filter(id=student_id).first()
