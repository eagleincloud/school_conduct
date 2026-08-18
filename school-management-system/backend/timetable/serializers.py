from rest_framework import serializers
from .models import TimeTableEntry, Shift

class ShiftSerializer(serializers.ModelSerializer):
    applies_to_display = serializers.CharField(source='get_applies_to_display', read_only=True)

    class Meta:
        model = Shift
        fields = [
            'id',
            'name',
            'start_time',
            'end_time',
            'is_flexible',
            'applies_to',
            'applies_to_display',
        ]

class TimeTableEntrySerializer(serializers.ModelSerializer):
    teacher_name = serializers.ReadOnlyField(source='teacher.name')
    day_display = serializers.CharField(source='get_day_display', read_only=True)
    start_time_display = serializers.SerializerMethodField()
    end_time_display = serializers.SerializerMethodField()
    shift_name = serializers.ReadOnlyField(source='shift_ref.name')

    class Meta:
        model = TimeTableEntry
        fields = [
            'id', 'class_name', 'section', 'subject', 'teacher', 
            'teacher_name', 'day', 'day_display', 'shift', 'shift_ref',
            'shift_name', 'period', 'period_number', 'start_time', 'end_time',
            'start_time_display', 'end_time_display', 'room'
        ]

    def get_start_time_display(self, obj):
        if obj.start_time:
            return obj.start_time.strftime("%I:%M %p")
        return ""

    def get_end_time_display(self, obj):
        if obj.end_time:
            return obj.end_time.strftime("%I:%M %p")
        return ""

    def validate(self, attrs):
        request = self.context.get('request')
        if not request or request.user.is_superuser:
            return attrs
        school_id = request.user.school_id
        teacher = attrs.get('teacher') or getattr(self.instance, 'teacher', None)
        shift_ref = attrs.get('shift_ref') or getattr(self.instance, 'shift_ref', None)
        if teacher and teacher.school_id != school_id:
            raise serializers.ValidationError({'teacher': 'Teacher must belong to your school.'})
        if shift_ref and shift_ref.school_id != school_id:
            raise serializers.ValidationError({'shift_ref': 'Shift must belong to your school.'})
        return attrs
