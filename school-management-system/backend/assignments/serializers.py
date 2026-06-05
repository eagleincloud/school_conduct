from rest_framework import serializers
from .models import Assignment, Submission

class AssignmentSerializer(serializers.ModelSerializer):
    attachment_url = serializers.SerializerMethodField(read_only=True)
    teacher_name = serializers.SerializerMethodField(read_only=True)
    class_name = serializers.SerializerMethodField(read_only=True)
    section_name = serializers.SerializerMethodField(read_only=True)
    class_section_display = serializers.SerializerMethodField(read_only=True)
    submission_count = serializers.SerializerMethodField(read_only=True)


    class Meta:
        model = Assignment
        fields = [
            'id',
            'title',
            'description',
            'subject',
            'teacher_name',
            'class_section',
            'class_name',
            'section_name',
            'class_section_display',
            'start_date',
            'due_date',
            'total_marks',
            'submission_type',
            'instructions',
            'attachment',
            'attachment_url',
            'file_url',
            'submission_count',
            'created_by',
            'created_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'attachment_url', 'submission_count']


    def get_attachment_url(self, obj):
        if obj.attachment:
            return obj.attachment.url
        return None

    def get_teacher_name(self, obj):
        if not obj.created_by:
            return None
        user = getattr(obj.created_by, 'user', None)
        if not user:
            return None
        return user.name or user.username

    def get_class_name(self, obj):
        cs = getattr(obj, 'class_section', None)
        if not cs or not getattr(cs, 'class_ref', None):
            return None
        return cs.class_ref.name

    def get_section_name(self, obj):
        cs = getattr(obj, 'class_section', None)
        if not cs or not getattr(cs, 'section_ref', None):
            return None
        return cs.section_ref.name

    def get_class_section_display(self, obj):
        class_name = self.get_class_name(obj)
        section_name = self.get_section_name(obj)
        if class_name and section_name:
            return f'{class_name} - {section_name}'
        return class_name or section_name

    def get_submission_count(self, obj):
        return obj.submissions.count()


    def validate(self, attrs):
        start_date = attrs.get('start_date')
        due_date = attrs.get('due_date')
        if start_date and due_date and due_date < start_date:
            raise serializers.ValidationError({'due_date': 'Due date cannot be before start date'})
        return attrs

    def validate_attachment(self, file_obj):
        if not file_obj:
            return file_obj
        name = (file_obj.name or '').lower()
        allowed = ('.pdf', '.doc', '.docx')
        if not name.endswith(allowed):
            raise serializers.ValidationError('Only PDF, DOC, and DOCX files are allowed')
        # Keep a conservative cap for assignment uploads.
        if file_obj.size > 10 * 1024 * 1024:
            raise serializers.ValidationError('File size must be <= 10 MB')
        return file_obj

class SubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = '__all__'

class SubmissionDetailSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField(read_only=True)
    student_roll = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Submission
        fields = [
            'id',
            'student',
            'student_name',
            'student_roll',
            'submission_date',
            'file_url',
            'marks',
            'feedback'
        ]

    def get_student_name(self, obj):
        user = getattr(obj.student, 'user', None)
        if user:
            return user.name or user.username
        return "Unknown Student"

    def get_student_roll(self, obj):
        return getattr(obj.student, 'roll_number', '-')

