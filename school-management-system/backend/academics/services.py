from .models import Exam, Result

class AcademicService:
    @staticmethod
    def get_class_exams(class_section_id):
        return Exam.objects.filter(class_section_id=class_section_id)

    @staticmethod
    def upload_result(student_id, exam_id, subject, marks, max_marks):
        result, created = Result.objects.update_or_create(
            student_id=student_id,
            exam_id=exam_id,
            subject=subject,
            defaults={'marks': marks, 'max_marks': max_marks}
        )
        return result
