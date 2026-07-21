import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from students.models import StudentProfile
from django.contrib.auth import get_user_model
from tenants.models import School

User = get_user_model()

try:
    student = StudentProfile.objects.get(id=18)
    user = student.user
    print("STUDENT ID 18 FOUND:")
    print(f"Username: {user.username}")
    print(f"Email: {user.email}")
    print(f"Name: {user.name}")
    print(f"Role: {user.role}")
    print(f"School: {user.school.name if user.school else 'None'} (ID: {user.school_id if user.school else 'None'})")
    if user.school:
         print(f"School Is Active: {user.school.is_active}")
    print(f"Is Active User: {user.is_active}")
except StudentProfile.DoesNotExist:
    print("Student with ID 18 does not exist.")

print("\nALL STUDENTS IN SYSTEM:")
for s in StudentProfile.objects.all():
    print(f"ID: {s.id}, Username: {s.user.username}, School: {s.user.school.name if s.user.school else 'None'}")
