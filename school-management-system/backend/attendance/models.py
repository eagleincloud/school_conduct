from django.db import models
from django.conf import settings

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
    school = models.ForeignKey('tenants.School', on_delete=models.CASCADE, related_name='biometric_devices')
    name = models.CharField(max_length=100, help_text="e.g. Main Gate, Hostel")
    device_ip = models.GenericIPAddressField(default="192.168.0.150")
    device_port = models.IntegerField(default=4370)
    device_password = models.IntegerField(default=0)
    machine_number = models.IntegerField(default=1)
    device_secret_key = models.CharField(max_length=255, default="y0ur_Sup3r_S3cr3t_B1om3tr1c_K3y_987")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.school.name} - {self.name} ({self.device_ip})"

