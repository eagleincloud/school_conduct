import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from students.models import StudentProfile
from teachers.models import TeacherProfile

def populate_schools():
    print("Populating schools for students...")
    students = StudentProfile.objects.all()
    count = 0
    for s in students:
        if s.user and s.user.school:
            s.school = s.user.school
            s.save()
            count += 1
    print(f"Updated {count} students.")

    print("Populating schools for teachers...")
    teachers = TeacherProfile.objects.all()
    count = 0
    for t in teachers:
        if t.user and t.user.school:
            t.school = t.user.school
            t.save()
            count += 1
    print(f"Updated {count} teachers.")

if __name__ == "__main__":
    populate_schools()
