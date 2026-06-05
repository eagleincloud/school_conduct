from rest_framework import serializers
from .models import Attendance

class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.name', read_only=True)

    class Meta:
        model = Attendance
        fields = [
            'id',
            'student',
            'student_name',
            'date',
            'status',
            'verification_status',
            'punch_time',
            'marked_by',
            'verified_by',
            'verified_at',
            'marked_via',
            'created_at',
        ]
