import os

from django.conf import settings
from django.http import HttpResponse
from rest_framework import views, status, permissions
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from accounts.models import User
from .models import TeacherProfile, TeacherDocument
from .pdf_id_card import build_teacher_id_card_pdf
from .serializers import TeacherProfileSerializer, TeacherDocumentSerializer
from core.permissions import IsAdmin, IsTeacher
from classes.models import ClassSection
from classes.teacher_access import teacher_accessible_class_sections_queryset
from subjects.models import TeacherAssignment
from assignments.models import Assignment as AssignmentModel
from attendance.models import Attendance as AttendanceModel
from django.db import transaction
import re
from accounts.utils import get_unique_username



def _next_employee_id(school):
    existing = TeacherProfile.objects.filter(school=school).values_list('employee_id', flat=True)
    used = set()
    for eid in existing:
        match = re.match(r'^T(\d+)$', str(eid or '').strip().upper())
        if match:
            used.add(int(match.group(1)))
    n = 1
    while n in used:
        n += 1
    return f"T{n:03d}"



def _teacher_role_label(profile: TeacherProfile) -> str:
    has_class = ClassSection.objects.filter(class_teacher=profile).exists()
    if has_class:
        return 'Class Teacher'
    return 'Teacher'


def ensure_teacher_profile(user):
    profile = TeacherProfile.objects.filter(user=user).first()
    if profile:
        return profile
    return TeacherProfile.objects.create(
        user=user,
        employee_id=_next_employee_id(user.school),

        subject_specialization='',
        status='Active',
    )


class TeacherProfileView(views.APIView):
    permission_classes = [IsTeacher]

    def _ensure_teacher_profile(self, user):
        return ensure_teacher_profile(user)

    def get(self, request):
        profile = self._ensure_teacher_profile(request.user)
        if profile:
            data = TeacherProfileSerializer(profile).data

            school = None if request.user.is_superuser else request.user.school
            classes_assigned_qs = teacher_accessible_class_sections_queryset(profile, school).select_related(
                'class_ref',
                'section_ref',
            )
            classes_assigned = []
            total_students = 0
            for cs in classes_assigned_qs:
                scount = cs.students.count()
                total_students += scount
                classes_assigned.append(
                    {
                        'id': cs.id,
                        'class_name': cs.class_ref.name,
                        'section_name': cs.section_ref.name,
                        'room_number': cs.room_number,
                        'student_count': scount,
                    }
                )

            # Strictly pull subjects from the TeacherAssignment model
            from subjects.models import TeacherAssignment
            assignments_qs = TeacherAssignment.objects.filter(teacher=profile).select_related('subject', 'class_ref').order_by('subject__name')
            
            subjects_assigned = []
            seen_subject_ids = set()
            for ta in assignments_qs:
                if ta.subject_id not in seen_subject_ids:
                    subjects_assigned.append({
                        'id': ta.subject.id,
                        'name': ta.subject.name,
                        'code': ta.subject.code,
                        'class_name': ta.class_ref.name,
                    })
                    seen_subject_ids.add(ta.subject_id)

            role_label = _teacher_role_label(profile)

            assignments_created = AssignmentModel.objects.filter(created_by=profile).count()
            attendance_records = AttendanceModel.objects.filter(marked_by=profile).count()

            data.update(
                {
                    'role_label': role_label,
                    'classes_assigned': classes_assigned,
                    'subjects_assigned': subjects_assigned,
                    'stats': {
                        'total_classes_handled': len(classes_assigned),
                        'total_students': total_students,
                        'assignments_created': assignments_created,
                        'attendance_records': attendance_records,
                    },
                }
            )

            photo_url = None
            has_photo = False
            if profile.photo and profile.photo.name:
                try:
                    photo_url = request.build_absolute_uri(profile.photo.url)
                    has_photo = True
                except ValueError:
                    pass
            data['photo_url'] = photo_url
            data['has_photo'] = has_photo

            return Response(data)
        return Response({"error": "Teacher profile not found"}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request):
        profile = self._ensure_teacher_profile(request.user)
        if not profile:
            return Response({"error": "Teacher profile not found"}, status=status.HTTP_404_NOT_FOUND)

        data = request.data

        # Update User fields
        if data.get('email') is not None:
            profile.user.email = data.get('email')
        if data.get('name') is not None:
            profile.user.name = data.get('name')
        if data.get('phone') is not None:
            profile.user.phone = data.get('phone')
        profile.user.save()

        # Update TeacherProfile fields
        if data.get('employee_id') is not None:
            profile.employee_id = data.get('employee_id')
        if data.get('subject_specialization') is not None:
            profile.subject_specialization = data.get('subject_specialization')
        if data.get('phone_number') is not None:
            profile.phone_number = data.get('phone_number')
        if data.get('gender') is not None:
            profile.gender = data.get('gender')
        if data.get('dob') is not None:
            profile.dob = data.get('dob')
        if data.get('qualification') is not None:
            profile.qualification = data.get('qualification')
        if data.get('experience_years') is not None:
            profile.experience_years = data.get('experience_years')
        if data.get('joining_date') is not None:
            profile.joining_date = data.get('joining_date')
        if data.get('status') is not None:
            profile.status = data.get('status')
        if data.get('profile_image_base64') is not None:
            profile.profile_image_base64 = data.get('profile_image_base64')
        profile.save()

        return self.get(request)


_ALLOWED_PHOTO_CT = frozenset(
    {
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/octet-stream',
    }
)


class TeacherProfilePhotoView(views.APIView):
    permission_classes = [IsTeacher]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        profile = ensure_teacher_profile(request.user)

        f = request.FILES.get('photo')
        if not f:
            return Response({'error': 'Send a file in field "photo"'}, status=status.HTTP_400_BAD_REQUEST)

        ext = os.path.splitext(f.name or '')[1].lower()
        if ext not in ('.jpg', '.jpeg', '.png', '.webp', '.gif'):
            return Response({'error': 'Allowed types: JPG, PNG, WebP, GIF'}, status=status.HTTP_400_BAD_REQUEST)

        ctype = (getattr(f, 'content_type', None) or '').lower()
        if ctype and ctype not in _ALLOWED_PHOTO_CT:
            return Response({'error': 'Invalid image content type'}, status=status.HTTP_400_BAD_REQUEST)

        if getattr(f, 'size', 0) > 4 * 1024 * 1024:
            return Response({'error': 'Image must be 4MB or smaller'}, status=status.HTTP_400_BAD_REQUEST)

        if profile.photo:
            profile.photo.delete(save=False)
        profile.photo = f
        profile.profile_image_base64 = None
        profile.save()

        photo_url = request.build_absolute_uri(profile.photo.url)
        return Response({'message': 'Photo saved', 'photo_url': photo_url, 'has_photo': True})

    def delete(self, request):
        profile = ensure_teacher_profile(request.user)

        if profile.photo:
            profile.photo.delete(save=False)
        profile.photo = None
        profile.profile_image_base64 = None
        profile.save(update_fields=['photo', 'profile_image_base64'])
        return Response({'message': 'Photo removed', 'photo_url': None, 'has_photo': False})


class TeacherIdCardPdfView(views.APIView):
    permission_classes = [IsTeacher]

    def get(self, request):
        profile = ensure_teacher_profile(request.user)
        profile = TeacherProfile.objects.select_related('user').filter(pk=profile.pk).first()
        if not profile:
            return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
        role_label = _teacher_role_label(profile)
        # Use the logged-in teacher's school branding for multi-school setups.
        school_obj = getattr(request.user, 'school', None)
        school_name = (
            getattr(school_obj, 'name', None)
            or getattr(settings, 'SCHOOL_NAME', 'School Management System')
        )
        pdf_bytes = build_teacher_id_card_pdf(
            profile,
            school_name=school_name,
            role_label=role_label,
            school_address=(
                getattr(school_obj, 'location', None)
                or getattr(settings, 'SCHOOL_ADDRESS', '')
            ),
            school_phone=getattr(settings, 'SCHOOL_PHONE', ''),
            school_email=(
                getattr(school_obj, 'contact_email', None)
                or getattr(settings, 'SCHOOL_EMAIL', '')
            ),
            school_website=getattr(settings, 'SCHOOL_WEBSITE', ''),
            logo_path=school_obj.logo.path if school_obj and school_obj.logo and os.path.exists(school_obj.logo.path) else None,
            hero_image_path=school_obj.hero_image.path if school_obj and school_obj.hero_image and os.path.exists(school_obj.hero_image.path) else None,
        )

        prefix = profile.school.school_id if profile.school else 'NS'
        full_id = f"{prefix}-{profile.employee_id}" if profile.employee_id else profile.id
        filename = f"teacher-id-card-{full_id}.pdf"
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        # Teachers are allowed to view only, not download.
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response


class TeacherDocumentsView(views.APIView):
    permission_classes = [IsTeacher]

    def _ensure_teacher_profile(self, user):
        profile = TeacherProfile.objects.filter(user=user).first()
        if profile:
            return profile

        return TeacherProfile.objects.create(
            user=user,
            employee_id=_next_employee_id(user.school),

            subject_specialization='',
            status='Active',
        )

    def get(self, request):
        profile = self._ensure_teacher_profile(request.user)
        if not profile:
            return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)
        docs = TeacherDocument.objects.filter(teacher=profile).order_by('-uploaded_at')
        return Response(TeacherDocumentSerializer(docs, many=True).data)

    def post(self, request):
        profile = self._ensure_teacher_profile(request.user)
        if not profile:
            return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

        file_obj = request.data.get('file')
        if not file_obj:
            return Response({'error': 'file is required'}, status=status.HTTP_400_BAD_REQUEST)

        name = (file_obj.name or '').lower()
        allowed_ext = ('.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.webp', '.gif')
        if not name.endswith(allowed_ext):
            return Response({'error': 'Unsupported file type'}, status=status.HTTP_400_BAD_REQUEST)

        doc = TeacherDocument.objects.create(teacher=profile, file=file_obj)
        return Response(TeacherDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


class TeacherListView(views.APIView):
    """
    Admin-only teacher list.
    Used by frontend `GET /api/teachers/`.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        school = request.user.school
        qs = TeacherProfile.objects.select_related('user')
        if not request.user.is_superuser:
            qs = qs.filter(user__school=school)
        profiles = qs.order_by('id')

        return Response([
            {
                "id": p.id,
                "user_id": p.user.id,
                "employee_id": f"{p.school.school_id if p.school else 'NS'}-{p.employee_id}",
                "name": p.user.name or p.user.username,


                "subject_specialization": p.subject_specialization,

                "email": p.user.email,
                "phone_number": p.phone_number,
                "gender": p.gender,
                "dob": p.dob,
                "qualification": p.qualification,
                "experience_years": p.experience_years,
                "joining_date": p.joining_date,
                "status": p.status,
            }
            for p in profiles
        ])


class TeacherDetailView(views.APIView):
    permission_classes = [IsAdmin]

    def get(self, request, teacher_id: int):
        school = request.user.school
        qs = TeacherProfile.objects.select_related('user').filter(id=teacher_id)
        if not request.user.is_superuser:
            qs = qs.filter(user__school=school)
            
        p = qs.first()
        if not p:
            return Response({"error": "Teacher not found"}, status=status.HTTP_404_NOT_FOUND)

        name = p.user.name or p.user.username
        return Response({
            "id": p.id,
            "user_id": p.user.id,
            "employee_id": f"{p.school.school_id if p.school else 'NS'}-{p.employee_id}",
            "name": p.user.name or p.user.username,


            "email": p.user.email,

            "subject_specialization": p.subject_specialization,
            "phone_number": p.phone_number,
            "gender": p.gender,
            "dob": p.dob,
            "qualification": p.qualification,
            "experience_years": p.experience_years,
            "joining_date": p.joining_date,
            "status": p.status,
            "profile_image_base64": p.profile_image_base64,
        })


class TeacherDeleteView(views.APIView):
    permission_classes = [IsAdmin]

    def delete(self, request, teacher_id: int):
        school = request.user.school
        qs = TeacherProfile.objects.select_related('user').filter(id=teacher_id)
        if not request.user.is_superuser:
            qs = qs.filter(user__school=school)
            
        p = qs.first()
        if not p:
            return Response({"error": "Teacher not found"}, status=status.HTTP_404_NOT_FOUND)
        try:
            with transaction.atomic():
                # Keep class sections and attendance records; only detach this teacher.
                ClassSection.objects.filter(class_teacher=p).update(class_teacher=None)
                AttendanceModel.objects.filter(marked_by=p).update(marked_by=None)
                AttendanceModel.objects.filter(verified_by=p).update(verified_by=None)

                # Clear M2M subject links explicitly before profile/user deletion.
                p.subjects.clear()

                # Delete auth user (TeacherProfile will cascade via OneToOne).
                p.user.delete()

            return Response({"message": "Teacher deleted successfully"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Error deleting teacher: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class TeacherUpdateView(views.APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, teacher_id: int):
        data = request.data
        school = request.user.school
        qs = TeacherProfile.objects.select_related('user').filter(id=teacher_id)
        if not request.user.is_superuser:
            qs = qs.filter(user__school=school)
            
        p = qs.first()
        if not p:
            return Response({"error": "Teacher not found"}, status=status.HTTP_404_NOT_FOUND)

        # Update User fields
        u = p.user
        u.email = data.get('email', u.email)

        # Support either `name` or first/last fields.
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        if data.get('name') is not None:
            u.name = data.get('name')
        elif first_name is not None or last_name is not None:
            u.first_name = first_name if first_name is not None else u.first_name
            u.last_name = last_name if last_name is not None else u.last_name
            u.name = f"{u.first_name} {u.last_name}".strip() or u.name
        u.save()

        # Helper to convert empty string to None, and keep default if None (for PATCH)
        def clean_field(val, default):
            if val is None: return default
            return val if val != "" else None

        # Update TeacherProfile fields
        raw_emp_id = data.get('employee_id')
        if raw_emp_id:
            if '-' in raw_emp_id:
                raw_emp_id = raw_emp_id.split('-', 1)[1]
            p.employee_id = raw_emp_id
        
        p.subject_specialization = data.get('subject_specialization', p.subject_specialization)


        p.phone_number = data.get('phone_number', p.phone_number)
        p.gender = data.get('gender', p.gender)
        p.dob = clean_field(data.get('dob'), p.dob)
        p.qualification = data.get('qualification', p.qualification)
        p.experience_years = clean_field(data.get('experience_years'), p.experience_years)
        p.joining_date = clean_field(data.get('joining_date'), p.joining_date)
        p.status = data.get('status', p.status)
        p.profile_image_base64 = data.get('profile_image_base64', p.profile_image_base64)
        p.save()

        return Response({"message": "Teacher updated successfully"}, status=status.HTTP_200_OK)

class AdminTeacherCreateView(views.APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        data = request.data
        try:
            # Check if email already exists (only if provided)
            email = data.get('email', '').strip() or None
            if email and User.objects.filter(email=email).exists():
                return Response({"error": "A user with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

            # Check if username already exists
            # (We will suffix it anyway, but we allow initial check to decide behavior)
            # Actually, per requirement 4, we auto-adjust with incremental suffix.
            # So we don't need this restrictive error check anymore.
            pass

            # Check if employee_id already exists
            requested_employee_id = (data.get('employee_id') or '').strip().upper()
            if requested_employee_id and '-' in requested_employee_id:
                requested_employee_id = requested_employee_id.split('-', 1)[1]
                
            if requested_employee_id and TeacherProfile.objects.filter(user__school=request.user.school, employee_id=requested_employee_id).exists():
                return Response({"error": "A teacher with this Employee ID already exists."}, status=status.HTTP_400_BAD_REQUEST)

            employee_id = requested_employee_id or _next_employee_id(request.user.school)


            school = request.user.school
            if not school and getattr(request.user, 'is_superuser', False):
                from tenants.models import School
                school = School.objects.first()

            user = User.objects.create_user(
                username=get_unique_username(data['username']),

                email=email,
                password=data['password'],
                name=data.get('name', ''),
                role='teacher',
                school=school
            )
            # Helper to convert empty string to None
            def clean_field(val):
                return val if val != "" else None

            profile = TeacherProfile.objects.create(
                user=user,
                employee_id=employee_id,
                subject_specialization=data.get('subject_specialization'),
                phone_number=data.get('phone_number'),
                gender=data.get('gender'),
                dob=clean_field(data.get('dob')),
                qualification=data.get('qualification'),
                experience_years=clean_field(data.get('experience_years')),
                joining_date=clean_field(data.get('joining_date')),
                status=data.get('status') or 'Active',
                profile_image_base64=data.get('profile_image_base64'),
            )
            return Response({"message": "Teacher created successfully"}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class TeacherListAllView(views.APIView):
    """
    Returns a simplified list of all teachers for selection in Doubts.
    Accessible to Students, Admins, and Teachers.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        school = request.user.school
        qs = TeacherProfile.objects.select_related('user').filter(status='Active')
        
        if school and not request.user.is_superuser:
            qs = qs.filter(user__school=school)
            
        profiles = qs.order_by('user__name')
        
        data = []
        for p in profiles:
            # Get subjects for this teacher
            from subjects.models import TeacherAssignment
            subjects_qs = TeacherAssignment.objects.filter(teacher=p).select_related('subject')
            subjects_list = [{'id': s.subject.id, 'name': s.subject.name} for s in subjects_qs]
            
            data.append({
                'id': p.id,
                'user_name': p.user.name or p.user.username,

                'subjects': subjects_list
            })

            
        return Response(data)

