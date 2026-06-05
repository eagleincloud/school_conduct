from rest_framework.exceptions import PermissionDenied
from .models import StudentProfile

def get_requested_student(request):
    """
    Returns the student profile for the current request.
    If student_id is provided in query params, it validates sibling relationship.
    """
    student_id = request.query_params.get("student_id")
    
    # Get the logged-in student's profile
    logged_student = getattr(request.user, 'student_profile', None)
    
    # If not attached, try fetching it
    if not logged_student and request.user.role == 'student':
        logged_student = StudentProfile.objects.filter(user=request.user).first()

    # If user is staff/admin, they can access any student if student_id is provided
    is_staff = request.user.is_superuser or request.user.role == 'admin'

    if student_id:
        try:
            target_student = StudentProfile.objects.select_related('parent', 'user', 'class_section').get(id=student_id)
            
            if is_staff:
                return target_student

            if not logged_student:
                raise PermissionDenied("Logged in student profile not found")

            # STRICT SECURITY CHECK
            if target_student.id == logged_student.id:
                return target_student

            # Ensure both have parent assigned
            if not logged_student.parent_id or not target_student.parent_id:
                raise PermissionDenied("Unauthorized: Parent linkage missing")

            if target_student.parent_id != logged_student.parent_id:
                raise PermissionDenied("Unauthorized: Not a sibling")

            return target_student
        except StudentProfile.DoesNotExist:
            raise PermissionDenied("Student not found")
        except Exception as e:
            if isinstance(e, PermissionDenied):
                raise e
            return logged_student

    return logged_student
