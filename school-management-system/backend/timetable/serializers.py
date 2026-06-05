from rest_framework import serializers
from .models import TimeTableEntry, Shift

class ShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shift
        fields = ['id', 'name', 'start_time', 'end_time']

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
