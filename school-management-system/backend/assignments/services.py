from .models import Assignment, Submission

class AssignmentService:
    @staticmethod
    def get_student_assignments(class_section_id):
        return Assignment.objects.filter(class_section_id=class_section_id)
