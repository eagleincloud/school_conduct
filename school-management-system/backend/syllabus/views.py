import logging
import os

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework import status, views, permissions
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from core.permissions import IsAdmin, IsStudent, IsTeacher
from subjects.models import Subject, TeacherAssignment
from classes.models import MainClass
from core.validators import validate_uploaded_file

from .models import Syllabus
from .serializers import SyllabusSerializer

logger = logging.getLogger(__name__)


def _is_platform_user(user):
    return bool(user.is_superuser or user.role == 'superadmin')


def _school_syllabi(user):
    qs = Syllabus.objects.all()
    if _is_platform_user(user):
        return qs
    if not user.school_id:
        return qs.none()
    return qs.filter(class_ref__school_id=user.school_id)


def _validated_class_subject(user, class_id, subject_id):
    classes = MainClass.objects.all()
    if not _is_platform_user(user):
        classes = classes.filter(school_id=user.school_id)
    class_ref = classes.filter(id=class_id).first()
    if not class_ref:
        return None, None
    subject = Subject.objects.filter(id=subject_id, class_ref=class_ref).first()
    return class_ref, subject


class AdminSyllabusControlView(views.APIView):
    """
    CRUD for Syllabus. Only Admin can POST, PATCH, DELETE.
    """
    permission_classes = [IsAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        class_id = request.data.get('class_id')
        subject_id = request.data.get('subject_id')
        title = (request.data.get('title') or '').strip()
        description = request.data.get('description') or ''
        file = request.FILES.get('file')

        if not class_id or not subject_id:
            return Response({'error': 'class_id and subject_id are required'}, status=status.HTTP_400_BAD_REQUEST)
        if not title:
            return Response({'error': 'title is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not file:
            return Response({'error': 'file is required'}, status=status.HTTP_400_BAD_REQUEST)

        class_ref, subject = _validated_class_subject(request.user, class_id, subject_id)
        if not class_ref or not subject:
            return Response({'error': 'Invalid class or subject.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_uploaded_file(file, allowed_extensions={'.pdf', '.doc', '.docx'})
        except ValueError as exc:
            return Response({'file': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            syllabus = Syllabus.objects.create(
                class_ref=class_ref,
                subject=subject,
                uploaded_by=request.user,
                title=title,
                description=description,
                file=file,
            )
            return Response(SyllabusSerializer(syllabus).data, status=status.HTTP_201_CREATED)
        except Exception:
            logger.exception('Failed to create syllabus')
            return Response({'error': 'Unable to create syllabus.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request, syllabus_id: int):
        syllabus = get_object_or_404(_school_syllabi(request.user), id=syllabus_id)
        
        # Allow updating file, title, description, class, or subject
        class_id = request.data.get('class_id')
        subject_id = request.data.get('subject_id')
        title = request.data.get('title')
        description = request.data.get('description')
        file = request.FILES.get('file')

        if class_id or subject_id:
            next_class_id = class_id or syllabus.class_ref_id
            next_subject_id = subject_id or syllabus.subject_id
            class_ref, subject = _validated_class_subject(request.user, next_class_id, next_subject_id)
            if not class_ref or not subject:
                return Response({'error': 'Invalid class or subject.'}, status=status.HTTP_400_BAD_REQUEST)
            syllabus.class_ref = class_ref
            syllabus.subject = subject
        if title: syllabus.title = title
        if description is not None: syllabus.description = description
        if file:
            try:
                validate_uploaded_file(file, allowed_extensions={'.pdf', '.doc', '.docx'})
            except ValueError as exc:
                return Response({'file': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            syllabus.file = file

        syllabus.save()
        return Response(SyllabusSerializer(syllabus).data)

    def delete(self, request, syllabus_id: int):
        syllabus = get_object_or_404(_school_syllabi(request.user), id=syllabus_id)
        syllabus.delete()
        return Response({'message': 'Syllabus deleted successfully'}, status=status.HTTP_200_OK)


class StudentSyllabusFiltersView(views.APIView):
    """
    Return the student's class and subjects for that class.
    """
    permission_classes = [IsStudent]

    def get(self, request):
        from students.utils import get_requested_student
        sp = get_requested_student(request)
        if not sp or not sp.class_section_id:
            return Response({'error': 'Student class not found'}, status=status.HTTP_400_BAD_REQUEST)

        class_ref_id = sp.class_section.class_ref_id
        class_name = sp.class_section.class_ref.name

        # Dynamic import to avoid circular dependency if any
        from subjects.models import Subject
        subjects = list(
            Subject.objects.filter(class_ref_id=class_ref_id, status='Active')
            .order_by('name')
        )
        return Response(
            {
                'class_id': class_ref_id,
                'class_name': class_name,
                'subjects': [{'id': s.id, 'name': s.name} for s in subjects],
            }
        )


class SyllabusListView(views.APIView):
    """
    Role-based syllabus list.
    - Admin: all syllabi
    - Teacher: filtered by assigned classes/subjects
    - Student: filtered by student class
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset_for_user(self, user):
        if user.role == 'admin' or _is_platform_user(user):
            return _school_syllabi(user)
        
        if user.role == 'teacher':
            teacher_profile = getattr(user, 'teacher_profile', None)
            if not teacher_profile:
                return Syllabus.objects.none()
            
            # Get assigned combinations
            assignments = TeacherAssignment.objects.filter(teacher=teacher_profile)
            if not assignments.exists():
                return Syllabus.objects.none()
            
            # Build Q objects for (class, subject) pairs
            query = Q()
            for a in assignments:
                query |= Q(class_ref_id=a.class_ref_id, subject_id=a.subject_id)
            
            return _school_syllabi(user).filter(query)

        if user.role == 'student':
            from students.utils import get_requested_student
            sp = get_requested_student(self.request)
            if not sp or not sp.class_section_id:
                return Syllabus.objects.none()
            return _school_syllabi(user).filter(class_ref_id=sp.class_section.class_ref_id)
        
        return Syllabus.objects.none()

    def get(self, request):
        qs = self.get_queryset_for_user(request.user).select_related('class_ref', 'subject', 'uploaded_by')
        
        # Filters
        class_id = request.query_params.get('class_id')
        subject_id = request.query_params.get('subject_id')
        search = (request.query_params.get('search') or '').strip()

        if class_id:
            qs = qs.filter(class_ref_id=class_id)
        if subject_id:
            qs = qs.filter(subject_id=subject_id)
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(subject__name__icontains=search))

        qs = qs.order_by('-uploaded_at')
        return Response(SyllabusSerializer(qs, many=True).data)


class SyllabusDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, syllabus_id: int):
        syllabus = get_object_or_404(_school_syllabi(request.user), id=syllabus_id)
        
        # Access control
        if request.user.role == 'admin':
            pass
        elif request.user.role == 'teacher':
            tp = request.user.teacher_profile
            can_access = TeacherAssignment.objects.filter(
                teacher=tp, class_ref_id=syllabus.class_ref_id, subject_id=syllabus.subject_id
            ).exists()
            if not can_access:
                return Response({'error': 'Not assigned to this syllabus'}, status=status.HTTP_403_FORBIDDEN)
        elif request.user.role == 'student':
            sp = request.user.student_profile
            if not sp.class_section_id or syllabus.class_ref_id != sp.class_section.class_ref_id:
                return Response({'error': 'Not your class syllabus'}, status=status.HTTP_403_FORBIDDEN)
        
        return Response(SyllabusSerializer(syllabus).data)


class StudentSyllabusDownloadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated] # Allowed for all authed roles if assigned

    def get(self, request, syllabus_id: int):
        syllabus = get_object_or_404(_school_syllabi(request.user), id=syllabus_id)
        
        # Access check
        if request.user.role == 'student':
            sp = request.user.student_profile
            if not sp.class_section_id or syllabus.class_ref_id != sp.class_section.class_ref_id:
                return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        elif request.user.role == 'teacher':
            tp = request.user.teacher_profile
            if not TeacherAssignment.objects.filter(teacher=tp, class_ref_id=syllabus.class_ref_id, subject_id=syllabus.subject_id).exists():
                return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        
        if not syllabus.file:
            return Response({'error': 'File not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            fh = syllabus.file.open('rb')
            response = FileResponse(fh)
            # Determine content type or use default
            response['Content-Disposition'] = f'attachment; filename="{os.path.basename(syllabus.file.name)}"'
            return response
        except Exception:
            logger.exception('Failed to open syllabus file id=%s', syllabus_id)
            return Response({'error': 'Unable to open file.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
