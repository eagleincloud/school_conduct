from django.contrib import admin
from .models import Attendance, BiometricDevice, TeacherAttendance, BiometricEventLog

@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('student', 'date', 'status', 'verification_status', 'marked_via', 'punch_time')
    list_filter = ('status', 'verification_status', 'marked_via', 'date')
    search_fields = ('student__user__username', 'student__user__name', 'student__rfid_code')

@admin.register(BiometricDevice)
class BiometricDeviceAdmin(admin.ModelAdmin):
    list_display = ('school', 'name', 'device_ip', 'device_port', 'machine_number', 'is_active')
    list_filter = ('school', 'is_active')
    search_fields = ('name', 'device_ip')

@admin.register(TeacherAttendance)
class TeacherAttendanceAdmin(admin.ModelAdmin):
    list_display = ('teacher', 'date', 'status', 'marked_via', 'punch_in_time', 'punch_out_time')
    list_filter = ('status', 'marked_via', 'date')
    search_fields = ('teacher__user__username', 'teacher__user__name', 'teacher__employee_id')

@admin.register(BiometricEventLog)
class BiometricEventLogAdmin(admin.ModelAdmin):
    list_display = ('received_at', 'status', 'event_type', 'user_identifier', 'device_serial_number', 'protocol', 'error_message')
    list_filter = ('status', 'event_type', 'protocol', 'received_at', 'school')
    search_fields = ('user_identifier', 'device_serial_number', 'error_message')
    readonly_fields = ('received_at', 'processed_at')
    ordering = ('-received_at',)
