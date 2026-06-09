from django.contrib import admin
from .models import Attendance, BiometricDevice

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
