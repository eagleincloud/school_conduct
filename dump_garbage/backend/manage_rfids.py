import os
import django
import sys

# Initialize Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from students.models import StudentProfile
from tenants.models import School

def list_rfids():
    students = StudentProfile.objects.exclude(rfid_code__isnull=True).exclude(rfid_code="")
    if not students.exists():
        print("\nNo students found with registered RFID codes.\n")
        return

    print("\n" + "=" * 80)
    print(f"{'Username':<20} | {'School ID':<12} | {'School Name':<25} | {'RFID Code':<15}")
    print("=" * 80)
    for s in students:
        school_id = s.school.school_id if s.school else "None"
        school_name = s.school.name if s.school else "None"
        print(f"{s.user.username:<20} | {school_id:<12} | {school_name[:25]:<25} | {s.rfid_code:<15}")
    print("=" * 80 + "\n")

def delete_rfid_by_username(username):
    student = StudentProfile.objects.filter(user__username=username).first()
    if not student:
        print(f"[ERROR] Student with username '{username}' does not exist.")
        return

    if not student.rfid_code:
        print(f"[INFO] Student '{username}' does not have any RFID code assigned.")
        return

    old_rfid = student.rfid_code
    student.rfid_code = None
    student.save()
    print(f"[SUCCESS] Removed RFID code '{old_rfid}' from student '{username}'.")

def delete_rfid_by_code(rfid_code):
    student = StudentProfile.objects.filter(rfid_code=rfid_code).first()
    if not student:
        print(f"[ERROR] No student found with RFID code '{rfid_code}'.")
        return

    student.rfid_code = None
    student.save()
    print(f"[SUCCESS] Removed RFID code '{rfid_code}' from student '{student.user.username}'.")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python manage_rfids.py list                     - List all students with registered RFID codes")
        print("  python manage_rfids.py delete-user <username>   - Clear RFID code for a specific username")
        print("  python manage_rfids.py delete-code <rfid_code>  - Clear RFID code by value")
    else:
        command = sys.argv[1].lower()
        if command == 'list':
            list_rfids()
        elif command == 'delete-user' and len(sys.argv) >= 3:
            delete_rfid_by_username(sys.argv[2])
        elif command == 'delete-code' and len(sys.argv) >= 3:
            delete_rfid_by_code(sys.argv[2])
        else:
            print("Invalid command or missing arguments.")
            print("Run without arguments for usage guide.")
