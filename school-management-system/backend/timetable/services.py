from .models import Timetable

class TimetableService:
    @staticmethod
    def get_class_schedule(class_section_id):
        return Timetable.objects.filter(class_section_id=class_section_id).order_by('day', 'start_time')
