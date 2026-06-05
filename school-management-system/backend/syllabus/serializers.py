from rest_framework import serializers

from .models import Syllabus


class SyllabusSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source='class_ref.name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    file_url = serializers.SerializerMethodField(read_only=True)
    uploaded_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Syllabus
        fields = [
            'id',
            'class_ref',
            'class_name',
            'subject',
            'subject_name',
            'title',
            'description',
            'file',
            'file_url',
            'uploaded_by',
            'uploaded_by_name',
            'uploaded_at',
            'updated_at',
        ]
        read_only_fields = ['uploaded_by', 'uploaded_by_name', 'uploaded_at', 'updated_at', 'file_url']

    def get_file_url(self, obj):
        try:
            return obj.file.url if obj.file else None
        except Exception:
            return None

    def get_uploaded_by_name(self, obj):
        if not obj.uploaded_by:
            return "System"
        return obj.uploaded_by.name or obj.uploaded_by.username

