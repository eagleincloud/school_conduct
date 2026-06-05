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
