import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from students.models import StudentProfile
from tenants.models import School

def set_rfid(username, school_id, rfid_code):
    try:
        # Check school
        school = School.objects.filter(school_id=school_id).first()
        if not school:
            print(f"[ERROR] School with ID '{school_id}' does not exist.")
            print("Available school IDs are:")
            for s in School.objects.all():
                print(f"  - {s.school_id} ({s.name})")
            return

        # Check student
        student = StudentProfile.objects.filter(user__username=username, school=school).first()
        if not student:
            print(f"[ERROR] Student with username '{username}' in school '{school_id}' does not exist.")
            print(f"Students in {school.name}:")
            for s in StudentProfile.objects.filter(school=school):
                print(f"  - {s.user.username} (RFID: {s.rfid_code})")
            return

        # Update RFID
        student.rfid_code = rfid_code
        student.save()
        print(f"[SUCCESS] Student '{username}' RFID has been updated to: '{rfid_code}' in school '{school.name}' ({school_id})")

    except Exception as e:
        print(f"[ERROR] Could not update RFID: {e}")

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python set_student_rfid.py <username> <school_id> <rfid_code>")
        print("Example: python set_student_rfid.py shivani DEFAULT TEST_RFID_123")
    else:
        username = sys.argv[1]
        school_id = sys.argv[2]
        rfid_code = sys.argv[3]
        set_rfid(username, school_id, rfid_code)
