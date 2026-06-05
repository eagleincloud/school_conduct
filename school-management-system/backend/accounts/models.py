from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager

def user_profile_photo_path(instance, filename):
    if instance.is_superuser or instance.role == 'superadmin':
        return f"School conduct/Root Users/{instance.username}/profile_photo/{filename}"
    elif getattr(instance, 'school', None):
        role_folder = "Students" if instance.role == 'student' else ("Teachers" if instance.role == 'teacher' else "Admins")
        return f"School conduct/Schools/{instance.school.name}/{role_folder}/{instance.username}/profile_photo/{filename}"
    else:
        return f"School conduct/Platform Users/{instance.username}/profile_photo/{filename}"

class UserManager(BaseUserManager):
    def create_user(self, username, email, password=None, **extra_fields):
        if email:
            email = self.normalize_email(email)
        else:
            email = None
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        return self.create_user(username, email, password, **extra_fields)

class User(AbstractUser):
    # Use the custom manager so `createsuperuser` sets `role='admin'` by default.
    objects = UserManager()
    ROLE_CHOICES = (
        ('superadmin', 'Superadmin'),
        ('dealer', 'Dealer'),
        ('admin', 'Admin'),
        ('teacher', 'Teacher'),
        ('student', 'Student'),
    )
    
    email = models.EmailField(unique=True, null=True, blank=True)
    name = models.CharField(max_length=255, blank=True, null=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='student')
    phone = models.CharField(max_length=15, blank=True, null=True)
    school = models.ForeignKey('tenants.School', on_delete=models.CASCADE, null=True, blank=True)
    profile_photo = models.ImageField(upload_to=user_profile_photo_path, null=True, blank=True, max_length=500)


    REQUIRED_FIELDS = []

    def __str__(self):
        return f"{self.username} ({self.role})"


class ActivityLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activities')
    action = models.CharField(max_length=255)
    entity = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.action} on {self.entity} at {self.timestamp}"
