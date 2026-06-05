from rest_framework import status, views, permissions
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import Assignment, Submission
from .serializers import AssignmentSerializer, SubmissionSerializer, SubmissionDetailSerializer

from core.permissions import IsTeacher, IsStudent
from students.models import StudentProfile
from students.utils import get_requested_student
from teachers.models import TeacherProfile
from communication.models import Notification

class AssignmentListView(views.APIView):
    """
    List assignments. Teachers see their own, students see their class's assignments.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role == 'student':
            student_profile = get_requested_student(request)
            if student_profile:
                assignments = Assignment.objects.filter(class_section=student_profile.class_section)
            else:
                assignments = []
        elif request.user.role == 'teacher':
            assignments = Assignment.objects.filter(created_by=request.user.teacher_profile)
        else:
            school = getattr(request.user, 'school', None)
            if not request.user.is_superuser and school:
                assignments = Assignment.objects.filter(class_section__school=school)
            else:
                assignments = Assignment.objects.all()

        serializer = AssignmentSerializer(assignments, many=True)
        return Response(serializer.data)

class AssignmentCreateView(views.APIView):
    """
    Teacher can POST new assignments.
    """
    permission_classes = [IsTeacher]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _ensure_teacher_profile(self, user):
        profile = TeacherProfile.objects.filter(user=user).first()
        if profile:
            return profile

        base_employee_id = f"T{user.id:04d}"
        employee_id = base_employee_id
        suffix = 1
        while TeacherProfile.objects.filter(employee_id=employee_id).exists():
            employee_id = f"{base_employee_id}_{suffix}"
            suffix += 1

        return TeacherProfile.objects.create(
            user=user,
            employee_id=employee_id,
            subject_specialization='',
            status='Active',
        )

    def post(self, request):
        teacher_profile = self._ensure_teacher_profile(request.user)
        serializer = AssignmentSerializer(data=request.data)
        if serializer.is_valid():
            assignment = serializer.save(created_by=teacher_profile)

            # Auto notify students of that class section.
            student_users = StudentProfile.objects.select_related('user').filter(
                class_section_id=assignment.class_section_id
            )
            notifications = []
            for sp in student_users:
                notifications.append(
                    Notification(
                        user=sp.user,
                        target_role=getattr(sp.user, 'role', None) or 'student',
                        title='New Assignment',
                        message=(
                            f"{assignment.subject}: {assignment.title} | "
                            f"Due: {assignment.due_date}"
                        ),
                    )
                )
            if notifications:
                Notification.objects.bulk_create(notifications)

            return Response(AssignmentSerializer(assignment).data, status=status.HTTP_201_CREATED)
        return Response(
            {'error': 'Invalid assignment data', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )


class AssignmentDetailView(views.APIView):
    """
    Teacher-only assignment detail/update/delete for assignments created by self.
    """

    permission_classes = [IsTeacher]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, request, assignment_id):
        teacher_profile = TeacherProfile.objects.filter(user=request.user).first()
        if not teacher_profile:
            return None
        return (
            Assignment.objects.select_related('class_section__class_ref', 'class_section__section_ref')
            .filter(id=assignment_id, created_by=teacher_profile)
            .first()
        )

    def get(self, request, assignment_id: int):
        assignment = self.get_object(request, assignment_id)
        if not assignment:
            return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AssignmentSerializer(assignment).data)

    def patch(self, request, assignment_id: int):
        assignment = self.get_object(request, assignment_id)
        if not assignment:
            return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AssignmentSerializer(assignment, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return Response(AssignmentSerializer(updated).data, status=status.HTTP_200_OK)
        return Response({'error': 'Invalid assignment data', 'details': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, assignment_id: int):
        assignment = self.get_object(request, assignment_id)
        if not assignment:
            return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)
        assignment.delete()
        return Response({'message': 'Assignment deleted successfully'}, status=status.HTTP_200_OK)


class MyAssignmentSubmissionsView(views.APIView):
    """
    Student-only: returns student's submissions mapped by assignment id.
    Used by dashboard to show Pending / Submitted status.
    """

    permission_classes = [IsStudent]

    def get(self, request):
        student_profile = get_requested_student(request)
        if not student_profile:
            return Response([])
        submissions_qs = (
            Submission.objects.select_related('assignment')
            .filter(student=student_profile)
            .order_by('-submission_date')
        )

        # Convert queryset to a compact structure for dashboard UI.
        data = []
        for s in submissions_qs:
            data.append(
                {
                    'assignment_id': s.assignment_id,
                    'submitted': True,
                    'submission_date': s.submission_date,
                    'file_url': getattr(s, 'file_url', None),
                    'marks': s.marks,
                }
            )
        return Response(data)


class StudentAssignmentSubmissionCreateView(views.APIView):
    """
    Student can submit an assignment (optional feature).

    Payload:
      - assignment_id (required)
      - file_url (required) : URL of the student's submitted work

    Notes:
      - Assignment access is restricted to the student's class_section.
      - If a submission already exists, it will be updated (unique_together).
    """

    permission_classes = [IsStudent]

    def post(self, request):
        student_profile = get_requested_student(request)
        if not student_profile:
            return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
        assignment_id = request.data.get('assignment_id')
        file_url = request.data.get('file_url')

        if not assignment_id:
            return Response({'error': 'assignment_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not file_url:
            return Response({'error': 'file_url is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            assignment_id = int(assignment_id)
        except Exception:
            return Response({'error': 'Invalid assignment_id'}, status=status.HTTP_400_BAD_REQUEST)

        assignment = (
            Assignment.objects.select_related('class_section', 'created_by')
            .filter(id=assignment_id, class_section=student_profile.class_section)
            .first()
        )
        if not assignment:
            return Response({'error': 'Assignment not found or not allowed'}, status=status.HTTP_404_NOT_FOUND)

        try:
            submission, _created = Submission.objects.update_or_create(
                assignment=assignment,
                student=student_profile,
                defaults={'file_url': file_url},
            )
        except Exception:
            return Response({'error': 'Could not save submission. Please provide a valid file URL.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                'assignment_id': submission.assignment_id,
                'submitted': True,
                'submission_date': submission.submission_date,
                'file_url': submission.file_url,
                'marks': submission.marks,
            },
            status=status.HTTP_201_CREATED,
        )

class AssignmentSubmissionsListView(views.APIView):
    """
    Teacher can GET all submissions for a specific assignment they created.
    """
    permission_classes = [IsTeacher]

    def get(self, request, assignment_id):
        teacher_profile = TeacherProfile.objects.filter(user=request.user).first()
        if not teacher_profile:
            return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

        assignment = Assignment.objects.filter(id=assignment_id, created_by=teacher_profile).first()
        if not assignment:
            return Response({'error': 'Assignment not found or access denied'}, status=status.HTTP_404_NOT_FOUND)

        submissions = Submission.objects.filter(assignment=assignment).select_related('student__user').order_by('-submission_date')
        serializer = SubmissionDetailSerializer(submissions, many=True)
        return Response(serializer.data)

