from rest_framework import serializers
from .models import TeacherProfile, TeacherDocument
from accounts.serializers import UserSerializer

class TeacherProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    employee_id = serializers.SerializerMethodField()
    
    def get_employee_id(self, obj):
        prefix = obj.school.school_id if obj.school else 'NS'
        return f"{prefix}-{obj.employee_id}"

    class Meta:
        model = TeacherProfile
        fields = [
            'id',
            'user',
            'employee_id',
            'subject_specialization',
            'phone_number',
            'gender',
            'dob',
            'qualification',
            'experience_years',
            'joining_date',
            'role',
            'status',
            'profile_image_base64',
        ]


class TeacherDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = TeacherDocument
        fields = ['id', 'file', 'file_url', 'uploaded_at']
        read_only_fields = ['file', 'file_url', 'uploaded_at']

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None
