import secrets

from django.db import models
from django.utils import timezone
from datetime import timedelta


def generate_device_secret_key():
    return secrets.token_urlsafe(24)

class Attendance(models.Model):
    STATUS_CHOICES = (
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
    )

    VERIFICATION_STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )
    
    VIA_CHOICES = (
        ('manual', 'Manual'),
        ('rfid', 'RFID'),
    )

    student = models.ForeignKey('students.StudentProfile', on_delete=models.CASCADE, related_name='attendance_records')
    class_section = models.ForeignKey('classes.ClassSection', on_delete=models.CASCADE, related_name='attendance_records', null=True, blank=True)
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)

    # Verification workflow (RFID/bio punch -> teacher approval).
    # - Students punch -> verification_status='pending'
    # - Teacher approves -> verification_status='approved' and status becomes 'present' (or 'late' if teacher sets late)
    # - Teacher rejects -> verification_status='rejected' and status becomes 'absent'
    verification_status = models.CharField(max_length=10, choices=VERIFICATION_STATUS_CHOICES, default='pending')
    punch_time = models.DateTimeField(blank=True, null=True)
    verified_by = models.ForeignKey('teachers.TeacherProfile', on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_attendance_records')
    verified_at = models.DateTimeField(blank=True, null=True)
    marked_by = models.ForeignKey('teachers.TeacherProfile', on_delete=models.SET_NULL, null=True, blank=True)
    marked_via = models.CharField(max_length=10, choices=VIA_CHOICES, default='manual')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'date')
        indexes = [
            models.Index(fields=['class_section', 'date']),
        ]

    def __str__(self):
        return f"{self.student.user.username} - {self.date} ({self.status}/{self.verification_status})"


class BiometricDevice(models.Model):
    ONLINE_WINDOW_SECONDS = 18
    DEVICE_TYPE_CHOICES = (
        ('fingerprint', 'Fingerprint'),
        ('rfid', 'RFID'),
        ('hybrid', 'Hybrid'),
    )

    school = models.ForeignKey('tenants.School', on_delete=models.CASCADE, related_name='biometric_devices')
    name = models.CharField(max_length=100, help_text="e.g. Main Gate, Hostel")
    site_label = models.CharField(max_length=120, blank=True, help_text="e.g. North Gate, Admin Block")
    device_type = models.CharField(max_length=20, choices=DEVICE_TYPE_CHOICES, default='hybrid')
    device_ip = models.GenericIPAddressField(default="192.168.0.150")
    device_port = models.IntegerField(default=4370)
    device_password = models.IntegerField(default=0)
    machine_number = models.IntegerField(default=1)
    bridge_server_url = models.URLField(blank=True, help_text="Optional override for the punch API endpoint used by this machine bridge.")
    device_secret_key = models.CharField(max_length=255, default=generate_device_secret_key)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    last_punch_at = models.DateTimeField(null=True, blank=True)
    last_tested_at = models.DateTimeField(null=True, blank=True)
    last_test_status = models.CharField(max_length=20, blank=True, default='')
    last_test_message = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['school__name', 'name', 'id']

    def __str__(self):
        return f"{self.school.name} - {self.name} ({self.device_ip})"

    def get_effective_server_url(self, default_url):
        return (self.bridge_server_url or '').strip() or default_url

    def build_bridge_config(self, default_server_url):
        return {
            "device_name": self.name,
            "device_ip": self.device_ip,
            "device_port": self.device_port,
            "device_password": self.device_password,
            "machine_number": self.machine_number,
            "school_id": self.school.school_id,
            "server_url": self.get_effective_server_url(default_server_url),
            "device_secret_key": self.device_secret_key,
        }

    def mark_test_result(self, ok, message):
        self.last_tested_at = timezone.now()
        self.last_test_status = 'online' if ok else 'offline'
        self.last_test_message = message[:255]
        self.save(update_fields=['last_tested_at', 'last_test_status', 'last_test_message'])

    def is_online_now(self):
        if not self.is_active or not self.last_seen_at:
            return False
        return self.last_seen_at >= timezone.now() - timedelta(seconds=self.ONLINE_WINDOW_SECONDS)

    def get_live_status_label(self):
        if not self.is_active:
            return 'disabled'
        if self.is_online_now():
            return 'online'
        if self.last_seen_at:
            return 'offline'
        if self.last_test_status:
            return self.last_test_status
        return 'not_tested'


class TeacherAttendance(models.Model):
    """
    Attendance record for teachers/staff, managed by the school admin.
    Separate from the student Attendance model to avoid coupling.
    """
    STATUS_CHOICES = (
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
    )
    VIA_CHOICES = (
        ('manual', 'Manual'),
        ('rfid', 'RFID'),
    )

    teacher = models.ForeignKey(
        'teachers.TeacherProfile',
        on_delete=models.CASCADE,
        related_name='attendance_records',
    )
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    punch_in_time = models.DateTimeField(blank=True, null=True)
    punch_out_time = models.DateTimeField(blank=True, null=True)
    marked_via = models.CharField(max_length=10, choices=VIA_CHOICES, default='manual')
    marked_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='teacher_attendance_marked',
    )
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('teacher', 'date')
        indexes = [
            models.Index(fields=['date']),
        ]

    def __str__(self):
        return f"{self.teacher.user.name} - {self.date} ({self.status})"

