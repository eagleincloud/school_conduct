import os
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from .models import School
from .serializers import PublicSchoolSerializer, SchoolAdminSerializer
from .bulk_id_service import generate_bulk_pdf
from students.models import StudentProfile
from teachers.models import TeacherProfile

class SchoolDetailView(APIView):
    """
    Public API to fetch branding and basic details of a specific school/tenant.
    Uses 'name' (which maps to school_id) to look up the tenant.
    Returns explicit 404 JSON if not found.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, name):
        name_upper = name.upper()
        
        # Use get_or_create for DEFAULT tenant to ensure no 404 in production
        if name_upper == 'DEFAULT':
            school, created = School.objects.get_or_create(
                school_id='DEFAULT',
                defaults={
                    'name': 'Default School',
                    'tagline': 'Welcome to our platform',
                    'is_active': True
                }
            )
        else:
            try:
                school = School.objects.get(school_id=name)
                created = False
            except School.DoesNotExist:
                return Response(
                    {"error": "Not Found", "message": f"School '{name}' not found."}, 
                    status=status.HTTP_404_NOT_FOUND
                )

        # Serialize full public details for the frontend
        serializer = PublicSchoolSerializer(school, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

class CommonSchoolInfoView(APIView):
    """
    Authenticated API to fetch branding details for the logged-in user's school.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'school') or not request.user.school:
            return Response({"error": "No school assigned to this user"}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = PublicSchoolSerializer(request.user.school)
        return Response(serializer.data)

class IsSuperAdmin(permissions.BasePermission):
    """Custom permission to only allow superadmins."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)

from rest_framework.decorators import action

class SuperadminSchoolViewSet(viewsets.ModelViewSet):
    """
    Superadmin API for full CRUD on Schools.
    """
    permission_classes = [IsSuperAdmin]
    serializer_class = SchoolAdminSerializer

    def get_queryset(self):
        return School.objects.annotate(
            user_count=Count('user'),
            teacher_count=Count('user', filter=Q(user__role='teacher')),
            student_count=Count('user', filter=Q(user__role='student'))
        )

    @action(detail=True, methods=['get'])
    def admins(self, request, pk=None):
        school = self.get_object()
        admins = school.user_set.filter(role='admin').values('name', 'email', 'username', 'is_active')
        return Response(admins)

class BulkIDCardGenerationView(APIView):
    """
    Superadmin-only API to generate bulk ID cards for students or teachers of a specific school.
    """
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        school_id = request.data.get('school_id')
        user_type = request.data.get('user_type') # 'student' or 'teacher'

        if not school_id or not user_type:
            return Response({"error": "school_id and user_type are required"}, status=status.HTTP_400_BAD_REQUEST)

        school = get_object_or_404(School, id=school_id)
        
        users_data = []
        if user_type == 'student':
            profiles = StudentProfile.objects.filter(user__school=school).select_related('user', 'class_section__class_ref', 'class_section__section_ref')
            for p in profiles:
                details = [
                    ('Adm No', p.admission_number),
                    ('Roll No', p.roll_number or '—'),
                    ('Class', f"{p.class_section.class_ref.name} {p.class_section.section_ref.name}" if p.class_section else '—'),
                    ('Father', p.father_name or '—'),
                    ('Blood Group', p.blood_group or '—'),
                    ('Phone', p.user.phone or p.father_contact or '—'),
                    ('Address', p.address or '—'),
                ]
                users_data.append({
                    'type_label': 'STUDENT ID CARD',
                    'name': p.user.name or p.user.username,
                    'photo_path': p.photo.path if p.photo and os.path.exists(p.photo.path) else None,
                    'details': details
                })
        elif user_type == 'teacher':
            profiles = TeacherProfile.objects.filter(user__school=school).select_related('user')
            for p in profiles:
                details = [
                    ('Emp ID', p.employee_id),
                    ('Role', p.role or 'Teacher'),
                    ('Phone', p.phone_number or '—'),
                    ('Subject', p.subject_specialization or '—'),
                    ('Status', p.status),
                ]
                users_data.append({
                    'type_label': 'TEACHER ID CARD',
                    'name': p.user.name or p.user.username,
                    'photo_path': p.photo.path if p.photo and os.path.exists(p.photo.path) else None,
                    'details': details
                })
        else:
            return Response({"error": "Invalid user_type. Must be 'student' or 'teacher'"}, status=status.HTTP_400_BAD_REQUEST)

        if not users_data:
            return Response({"error": f"No {user_type}s found for this school"}, status=status.HTTP_404_NOT_FOUND)

        school_info = {
            'name': school.name,
            'address': school.address or school.location,
            'hero_image_path': school.hero_image.path if school.hero_image and os.path.exists(school.hero_image.path) else None,
            'logo_path': school.logo.path if school.logo and os.path.exists(school.logo.path) else None,
        }

        pdf_bytes = generate_bulk_pdf(users_data, school_info)
        
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="bulk_{user_type}_id_cards_{school.school_id}.pdf"'
        return response

