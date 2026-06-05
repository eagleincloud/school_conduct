from accounts.models import User
from students.models import StudentProfile
from teachers.models import TeacherProfile

class AccountService:
    @staticmethod
    def create_student(data):
        user = User.objects.create_user(
            username=data['username'],
            email=data['email'],
            password=data['password'],
            name=data.get('name', ''),
            role='student'
        )
        profile = StudentProfile.objects.create(
            user=user,
            admission_number=data['admission_number'],
            rfid_code=data.get('rfid_code'),
            class_section_id=data.get('class_section_id'),
            dob=data.get('dob'),
            gender=data.get('gender'),
            address=data.get('address')
        )
        return user, profile

    @staticmethod
    def create_teacher(data):
        user = User.objects.create_user(
            username=data['username'],
            email=data['email'],
            password=data['password'],
            name=data.get('name', ''),
            role='teacher'
        )
        profile = TeacherProfile.objects.create(
            user=user,
            employee_id=data['employee_id'],
            subject_specialization=data.get('subject_specialization')
        )
        return user, profile
