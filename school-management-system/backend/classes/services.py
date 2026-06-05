from .models import ClassSection

class ClassService:
    @staticmethod
    def get_all_sections():
        return ClassSection.objects.all()
