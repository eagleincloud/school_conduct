from rest_framework import serializers

from .models import Subject, SubjectNote, SubjectAssignment, TeacherAssignment
from teachers.models import TeacherProfile


class TeacherShortSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = TeacherProfile
        fields = ['id', 'employee_id', 'name']

    def get_name(self, obj):
        return obj.user.name or obj.user.username


class SubjectNoteSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = SubjectNote
        fields = ['id', 'title', 'description', 'file_url', 'link_url', 'created_at']

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None


class SubjectAssignmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = SubjectAssignment
        fields = ['id', 'title', 'due_date', 'file_url', 'created_at']

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None


class SubjectDetailsSerializer(serializers.ModelSerializer):
    teachers = TeacherShortSerializer(many=True)
    notes = SubjectNoteSerializer(many=True, read_only=True)
    assignments = SubjectAssignmentSerializer(many=True, read_only=True)

    class Meta:
        model = Subject
        fields = ['id', 'name', 'code', 'class_ref', 'teachers', 'description', 'status', 'notes', 'assignments']


class SubjectListSerializer(serializers.ModelSerializer):
    class_name = serializers.SerializerMethodField()
    teachers = TeacherShortSerializer(many=True)

    class Meta:
        model = Subject
        fields = ['id', 'name', 'code', 'class_ref', 'class_name', 'teachers', 'description', 'status']

    def get_class_name(self, obj):
        return obj.class_ref.name if obj.class_ref else None


class TeacherAssignmentSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    employee_id = serializers.CharField(source='teacher.employee_id', read_only=True)
    class_name = serializers.CharField(source='class_ref.name', read_only=True)
    section_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)

    class Meta:
        model = TeacherAssignment
        fields = [
            'id',
            'teacher',
            'teacher_name',
            'employee_id',
            'class_ref',
            'class_name',
            'section',
            'section_name',
            'subject',
            'subject_name',
            'role',
            'created_at',
            'updated_at',
        ]

    def get_teacher_name(self, obj):
        return obj.teacher.user.name or obj.teacher.user.username

    def get_section_name(self, obj):
        return obj.section.section_ref.name if obj.section and obj.section.section_ref else None

