from rest_framework import serializers
from .models import Exam, Result, ExamSchedule, Marks, ResultStatus

class ExamScheduleSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source='exam.class_section.class_ref.name', read_only=True)
    section_name = serializers.CharField(source='exam.class_section.section_ref.name', read_only=True)

    class Meta:
        model = ExamSchedule
        fields = ['id', 'exam', 'subject', 'exam_date', 'start_time', 'end_time', 'class_name', 'section_name']

class ExamSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source='class_section.class_ref.name', read_only=True)
    section_name = serializers.CharField(source='class_section.section_ref.name', read_only=True)
    class_section_display = serializers.SerializerMethodField()
    type = serializers.CharField(source='exam_type', required=False)
    is_published = serializers.BooleanField(source='result_published', required=False)
    schedules = ExamScheduleSerializer(many=True, read_only=True)

    class Meta:
        model = Exam
        fields = [
            'id',
            'name',
            'class_section',
            'class_name',
            'section_name',
            'class_section_display',
            'type',
            'exam_type',
            'start_date',
            'end_date',
            'total_marks',
            'passing_marks',
            'status',
            'description',
            'date',
            'is_published',
            'result_published',
            'schedules',
        ]

    def get_class_section_display(self, obj):
        return f"{obj.class_section.class_ref.name} - {obj.class_section.section_ref.name}"



class ResultSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.name', read_only=True)
    exam_name = serializers.CharField(source='exam.name', read_only=True)
    percentage = serializers.SerializerMethodField()
    grade = serializers.SerializerMethodField()
    result_status = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Result
        fields = [
            'id',
            'student',
            'student_name',
            'exam',
            'exam_name',
            'subject',
            'marks',
            'max_marks',
            'absent',
            'percentage',
            'grade',
            'result_status',
            'status',
        ]

    def get_percentage(self, obj):
        if obj.absent or obj.marks is None or not obj.max_marks:
            return 0
        return round((float(obj.marks) / float(obj.max_marks)) * 100, 2)

    def get_grade(self, obj):
        if obj.absent or obj.marks is None:
            return 'ABS'
        pct = self.get_percentage(obj)
        if pct >= 90:
            return 'A+'
        if pct >= 80:
            return 'A'
        if pct >= 70:
            return 'B'
        if pct >= 60:
            return 'C'
        if pct >= 50:
            return 'D'
        return 'F'

    def get_result_status(self, obj):
        if obj.absent or obj.marks is None:
            return 'Absent'
        # Uses exam-level passing marks when available.
        pass_mark = float(obj.exam.passing_marks or 0)
        return 'Pass' if float(obj.marks) >= pass_mark else 'Fail'

    def get_status(self, obj):
        if obj.absent:
            return 'Submitted'
        return 'Submitted' if obj.marks is not None else 'Pending'

class MarksSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    exam_type_display = serializers.CharField(source='get_exam_type_display', read_only=True)

    class Meta:
        model = Marks
        fields = [
            'id', 'student', 'student_name', 'subject', 'subject_name',
            'class_section', 'exam_type', 'exam_type_display',
            'marks', 'max_marks', 'is_uploaded', 'is_locked',
            'uploaded_by', 'updated_at'
        ]

class ResultStatusSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source='class_section.class_ref.name', read_only=True)
    section_name = serializers.CharField(source='class_section.section_ref.name', read_only=True)
    published_by_name = serializers.CharField(source='published_by.name', read_only=True)

    class Meta:
        model = ResultStatus
        fields = [
            'id', 'class_section', 'class_name', 'section_name',
            'exam_type', 'is_published', 'published_at', 'published_by', 'published_by_name'
        ]
