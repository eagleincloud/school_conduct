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
    ONLINE_WINDOW_SECONDS = 300
    TEST_ONLINE_WINDOW_SECONDS = 120
    DIRECT_PUSH_INTEGRATION_MODES = ('tcp_xml_push', 'http_push')
    DEVICE_TYPE_CHOICES = (
        ('fingerprint', 'Fingerprint'),
        ('rfid', 'RFID'),
        ('hybrid', 'Hybrid'),
    )
    INTEGRATION_MODE_CHOICES = (
        ('bridge_pull', 'Bridge Pull'),
        ('tcp_xml_push', 'TCP XML Push'),
        ('http_push', 'HTTP Push'),
    )

    school = models.ForeignKey('tenants.School', on_delete=models.CASCADE, related_name='biometric_devices')
    name = models.CharField(max_length=100, help_text="e.g. Main Gate, Hostel")
    site_label = models.CharField(max_length=120, blank=True, help_text="e.g. North Gate, Admin Block")
    device_type = models.CharField(max_length=20, choices=DEVICE_TYPE_CHOICES, default='hybrid')
    integration_mode = models.CharField(max_length=20, choices=INTEGRATION_MODE_CHOICES, default='bridge_pull')
    device_ip = models.GenericIPAddressField(default="192.168.0.150")
    device_port = models.IntegerField(default=4370)
    device_password = models.IntegerField(default=0)
    machine_number = models.IntegerField(default=1)
    device_serial_number = models.CharField(max_length=100, blank=True)
    terminal_id = models.CharField(max_length=100, blank=True)
    allowed_source_ip = models.GenericIPAddressField(null=True, blank=True)
    bridge_server_url = models.URLField(blank=True, help_text="Optional override for the punch API endpoint used by this machine bridge.")
    device_secret_key = models.CharField(max_length=255, default=generate_device_secret_key)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    last_punch_at = models.DateTimeField(null=True, blank=True)
    last_tested_at = models.DateTimeField(null=True, blank=True)
    last_test_status = models.CharField(max_length=20, blank=True, default='')
    last_test_message = models.CharField(max_length=255, blank=True, default='')
    last_event_type = models.CharField(max_length=50, blank=True, default='')
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
            "integration_mode": self.integration_mode,
            "device_ip": self.device_ip,
            "device_port": self.device_port,
            "device_password": self.device_password,
            "machine_number": self.machine_number,
            "device_serial_number": self.device_serial_number,
            "terminal_id": self.terminal_id,
            "allowed_source_ip": self.allowed_source_ip,
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
        if not self.is_active:
            return False
        now = timezone.now()
        if self.last_seen_at and self.last_seen_at >= now - timedelta(seconds=self.ONLINE_WINDOW_SECONDS):
            return True
        if self.integration_mode in self.DIRECT_PUSH_INTEGRATION_MODES:
            return False
        if (
            self.last_test_status == 'online'
            and self.last_tested_at
            and self.last_tested_at >= now - timedelta(seconds=self.TEST_ONLINE_WINDOW_SECONDS)
        ):
            return True
        return False

    def get_live_status_label(self):
        if not self.is_active:
            return 'disabled'
        if self.is_online_now():
            return 'online'
        if self.integration_mode in self.DIRECT_PUSH_INTEGRATION_MODES:
            if self.last_seen_at:
                return 'offline'
            return 'awaiting_push'
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


class BiometricEventLog(models.Model):
    PROTOCOL_CHOICES = (
        ('http', 'HTTP'),
        ('tcp_xml', 'TCP XML'),
    )
    STATUS_CHOICES = (
        ('received', 'Received'),
        ('processed', 'Processed'),
        ('duplicate', 'Duplicate'),
        ('ignored', 'Ignored'),
        ('unmatched', 'Unmatched'),
        ('unauthorized', 'Unauthorized'),
        ('failed', 'Failed'),
    )

    device = models.ForeignKey(
        'attendance.BiometricDevice',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='event_logs',
    )
    school = models.ForeignKey(
        'tenants.School',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='biometric_event_logs',
    )
    attendance = models.ForeignKey(
        'attendance.Attendance',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='biometric_event_logs',
    )
    teacher_attendance = models.ForeignKey(
        'attendance.TeacherAttendance',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='biometric_event_logs',
    )
    protocol = models.CharField(max_length=20, choices=PROTOCOL_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='received')
    event_fingerprint = models.CharField(max_length=64, unique=True)
    source_ip = models.GenericIPAddressField(null=True, blank=True)
    device_serial_number = models.CharField(max_length=100, blank=True)
    terminal_id = models.CharField(max_length=100, blank=True)
    trans_id = models.CharField(max_length=100, blank=True)
    event_type = models.CharField(max_length=50, blank=True)
    user_identifier = models.CharField(max_length=100, blank=True)
    attend_stat = models.CharField(max_length=100, blank=True)
    verify_mode = models.CharField(max_length=100, blank=True)
    punch_time = models.DateTimeField(null=True, blank=True)
    raw_payload = models.TextField(blank=True)
    normalized_payload = models.JSONField(default=dict, blank=True)
    error_message = models.CharField(max_length=255, blank=True, default='')
    received_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-received_at']
        indexes = [
            models.Index(fields=['device_serial_number', 'received_at']),
            models.Index(fields=['status', 'received_at']),
            models.Index(fields=['event_type', 'received_at']),
        ]

    def __str__(self):
        return f"{self.protocol}:{self.event_type or 'unknown'}:{self.device_serial_number or 'unbound'}"

