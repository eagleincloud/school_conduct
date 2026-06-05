from .models import TeacherProfile

class TeacherService:
    @staticmethod
    def get_profile(user_id):
        return TeacherProfile.objects.filter(user_id=user_id).first()
