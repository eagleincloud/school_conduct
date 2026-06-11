import uuid
from django.db import models
from django.conf import settings

def teacher_photo_path(instance, filename):
    school_name = instance.school.name if getattr(instance, 'school', None) else 'Unassigned'
    username = instance.user.username if getattr(instance, 'user', None) else 'Unknown'
    return f"School conduct/Schools/{school_name}/Teachers/{username}/profile_photo/{filename}"

def teacher_document_path(instance, filename):
    school_name = instance.teacher.school.name if getattr(instance.teacher, 'school', None) else 'Unassigned'
    username = instance.teacher.user.username if getattr(instance.teacher, 'user', None) else 'Unknown'
    return f"School conduct/Schools/{school_name}/Teachers/{username}/documents/{filename}"

class TeacherProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='teacher_profile')
    school = models.ForeignKey('tenants.School', on_delete=models.CASCADE, null=True, blank=True)
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, null=True)
    employee_id = models.CharField(max_length=50) # removed unique=True
    subject_specialization = models.CharField(max_length=255, blank=True, null=True)
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    gender = models.CharField(max_length=10, blank=True, null=True)
    dob = models.DateField(blank=True, null=True)
    qualification = models.CharField(max_length=255, blank=True, null=True)
    experience_years = models.PositiveIntegerField(blank=True, null=True)
    joining_date = models.DateField(blank=True, null=True)
    role = models.CharField(
        max_length=20, 
        choices=[
            ('Class Teacher', 'Class Teacher'),
            ('Subject Teacher', 'Subject Teacher'),
            ('Staff', 'Staff'),
        ],
        default='Subject Teacher'
    )
    status = models.CharField(max_length=10, default='Active')
    profile_image_base64 = models.TextField(blank=True, null=True)
    photo = models.ImageField(upload_to=teacher_photo_path, blank=True, null=True, max_length=500)
    rfid_code = models.CharField(max_length=100, unique=True, blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['school', 'employee_id'],
                name='unique_employee_per_school',
            )
        ]

    def __str__(self):
        return f"{self.user.name} ({self.employee_id})"

class TeacherDocument(models.Model):
    """
    Optional teacher documents (certificates, resume, etc.).
    Teachers can upload and view them from their profile.
    """
    teacher = models.ForeignKey(TeacherProfile, on_delete=models.CASCADE, related_name='documents')
    file = models.FileField(upload_to=teacher_document_path, blank=True, null=True, max_length=500)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Document for {self.teacher.employee_id}"
