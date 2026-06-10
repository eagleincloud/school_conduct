import os

from django.conf import settings
from django.http import HttpResponse
from rest_framework import status, views, permissions
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from accounts.models import User
from accounts.utils import get_unique_username
from .models import StudentProfile, Parent
from .pdf_id_card import build_student_id_card_pdf
from .utils import get_requested_student
from core.permissions import IsAdmin
from classes.models import ClassSection, MainClass, MainSection
from classes.teacher_access import teacher_teaches_class_section
import re
from attendance.models import Attendance
from attendance.serializers import AttendanceSerializer
from assignments.models import Assignment, Submission
from academics.models import Result, Exam
from fees.models import StudentFee
from timetable.models import TimeTableEntry
from timetable.serializers import TimeTableEntrySerializer
from communication.models import Notification
from communication.serializers import NotificationSerializer
from django.db.models import Q
from django.db import IntegrityError, transaction



def _roll_suffix_for_section(class_section):
    if not class_section or not getattr(class_section, 'section_ref', None):
        return ''
    name = (class_section.section_ref.name or '').strip()
    for ch in name:
        if ch.isalpha():
            return ch.upper()
    return (name[:1] or '').upper()


def _next_roll_number_for_class_section(class_section):
    suffix = _roll_suffix_for_section(class_section)
    existing = (
        StudentProfile.objects.filter(class_section=class_section, roll_number__isnull=False)
        .exclude(roll_number='')
        .values_list('roll_number', flat=True)
    )
    max_numeric = 100
    for roll in existing:
        match = re.match(r'^(\d+)', str(roll).strip())
        if match:
            num = int(match.group(1))
            if num > max_numeric:
                max_numeric = num
    return f"{max_numeric + 1}{suffix}"


def _next_admission_number(school):
    existing = StudentProfile.objects.filter(school=school).values_list('admission_number', flat=True)
    used = set()
    for adm in existing:
        match = re.match(r'^ADM(\d+)$', str(adm or '').strip().upper())
        if match:
            used.add(int(match.group(1)))

    # Always start from ADM101 and assign the first free number.
    n = 101
    while n in used:
        n += 1
    return f"ADM{n}"


class StudentListView(views.APIView):
    """
    Admin-only students list.
    Returns flat fields to match existing frontend table rendering.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        school = request.user.school
        qs = StudentProfile.objects.select_related(
                'user',
                'class_section__class_ref',
                'class_section__section_ref',
            )
        if not request.user.is_superuser:
            qs = qs.filter(user__school=school)
        records = qs.order_by('id')

        return Response([
            {
                "id": s.id,
                "admission_number": f"{s.school.school_id if s.school else 'NS'}-{s.admission_number}",
                "roll_number": s.roll_number,

                "name": s.user.name or s.user.username,

                "first_name": s.user.first_name,
                "last_name": s.user.last_name,

                "username": s.user.username,
                "email": s.user.email,
                "dob": s.dob,
                "gender": s.gender,
                "blood_group": s.blood_group,
                "father_name": s.father_name,
                "mother_name": s.mother_name,
                "father_contact": s.father_contact,
                "mother_contact": s.mother_contact,
                "bus_no": s.bus_no,
                "address": s.address,
                "date_of_admission": s.date_of_admission,
                "category": s.category,
                "rfid_code": s.rfid_code,
                "class_name": (
                    f"{s.class_section.class_ref.name} - {s.class_section.section_ref.name}"
                    if s.class_section else "N/A"
                ),
            }
            for s in records
        ])


class StudentsByClassSectionView(views.APIView):
    """
    Returns students for a specific `ClassSection`.
    Used by teacher result upload to implement Exam -> Class -> Student flow.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, class_section_id: int):
        if request.user.role not in ('teacher', 'admin'):
            return Response({"error": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        school = request.user.school
        qs = StudentProfile.objects.select_related('user').filter(class_section_id=class_section_id)
        if not request.user.is_superuser:
            qs = qs.filter(user__school=school)

        # Teachers can only see students from their assigned classes.
        if request.user.role == 'teacher':
            teacher_profile = getattr(request.user, 'teacher_profile', None)
            
            class_section = ClassSection.objects.filter(id=class_section_id).first()
            if not class_section or not teacher_profile or not teacher_teaches_class_section(teacher_profile, class_section):
                return Response({"error": "Not allowed for this class"}, status=status.HTTP_403_FORBIDDEN)

        records = qs.order_by('id')

        return Response([
            {
                "id": s.id,
                "admission_number": f"{s.school.school_id if s.school else 'NS'}-{s.admission_number}",
                "roll_number": s.roll_number,

                "name": s.user.name or s.user.username,

                "username": s.user.username,

                "email": s.user.email,
                "class_name": s.class_section.class_ref.name if s.class_section else None,
                "section_name": s.class_section.section_ref.name if s.class_section else None,
            }
            for s in records
        ])


class StudentDetailView(views.APIView):
    permission_classes = [IsAdmin]

    def get(self, request, student_id: int):
        school = request.user.school
        qs = StudentProfile.objects.select_related(
                'user',
                'class_section__class_ref',
                'class_section__section_ref',
            ).filter(id=student_id)
        if not request.user.is_superuser:
            qs = qs.filter(user__school=school)
            
        s = qs.first()
        if not s:
            return Response({"error": "Student not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            {
                "id": s.id,
                "admission_number": f"{s.school.school_id if s.school else 'NS'}-{s.admission_number}",
                "roll_number": s.roll_number,
                "name": s.user.name or s.user.username,


                "first_name": s.user.first_name,
                "last_name": s.user.last_name,
                "username": s.user.username,
                "email": s.user.email,
                "dob": s.dob,
                "gender": s.gender,
                "blood_group": s.blood_group,
                "father_name": s.father_name,
                "mother_name": s.mother_name,
                "father_contact": s.father_contact,
                "mother_contact": s.mother_contact,
                "bus_no": s.bus_no,
                "address": s.address,
                "date_of_admission": s.date_of_admission,
                "category": s.category,
                "rfid_code": s.rfid_code,
                "class_name": (
                    f"{s.class_section.class_ref.name} - {s.class_section.section_ref.name}"
                    if s.class_section else "N/A"
                ),
            }
        )


class StudentDeleteView(views.APIView):
    permission_classes = [IsAdmin]

    def delete(self, request, student_id: int):
        school = request.user.school
        qs = StudentProfile.objects.select_related('user').filter(id=student_id)
        if not request.user.is_superuser:
            qs = qs.filter(user__school=school)
            
        s = qs.first()
        if not s:
            return Response({"error": "Student not found"}, status=status.HTTP_404_NOT_FOUND)
        # Delete user first; StudentProfile is OneToOne so deletion should cascade/clean up.
        s.user.delete()
        return Response({"message": "Student deleted successfully"}, status=status.HTTP_200_OK)


class StudentUpdateView(views.APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, student_id: int):
        data = request.data
        school = request.user.school
        qs = StudentProfile.objects.select_related('user').filter(id=student_id)
        if not request.user.is_superuser:
            qs = qs.filter(user__school=school)
            
        s = qs.first()
        if not s:
            return Response({"error": "Student not found"}, status=status.HTTP_404_NOT_FOUND)

        u = s.user
        # Update User fields (no password change here).
        u.first_name = data.get('first_name', u.first_name)
        u.last_name = data.get('last_name', u.last_name)
        u.email = data.get('email', u.email)
        u.name = data.get('name', f"{u.first_name} {u.last_name}".strip())
        u.save()

        # Update StudentProfile fields.
        raw_admission = data.get('admission_number')
        if raw_admission:
            # Strip school prefix if present
            if '-' in raw_admission:
                raw_admission = raw_admission.split('-', 1)[1]
            s.admission_number = raw_admission
        
        if data.get('roll_number') is not None:

            s.roll_number = data.get('roll_number')
        s.dob = data.get('dob', s.dob)
        s.gender = data.get('gender', s.gender)
        s.blood_group = data.get('blood_group', s.blood_group)
        s.father_name = data.get('father_name', s.father_name)
        s.mother_name = data.get('mother_name', s.mother_name)
        s.father_contact = data.get('father_contact', s.father_contact)
        s.mother_contact = data.get('mother_contact', s.mother_contact)
        s.bus_no = data.get('bus_no', s.bus_no)
        s.address = data.get('address', s.address)
        s.date_of_admission = data.get('date_of_admission', s.date_of_admission)
        s.category = data.get('category', s.category)
        if 'rfid_code' in data:
            rfid_val = data.get('rfid_code')
            if rfid_val is not None:
                rfid_val = str(rfid_val).strip()
                s.rfid_code = rfid_val if rfid_val else None
            else:
                s.rfid_code = None
        s.save()

        return Response({"message": "Student updated successfully"}, status=status.HTTP_200_OK)

class AdminStudentCreateView(views.APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        data = request.data
        try:
            school = request.user.school
            if not school and getattr(request.user, 'is_superuser', False):
                from tenants.models import School
                school = School.objects.first()

            class_section_id = data.get('class_section_id')
            if not class_section_id:
                # Support class + section dropdown based creation
                class_id = data.get('class_id')
                section_id = data.get('section_id')
                if class_id and section_id:
                    c_obj = MainClass.objects.get(id=class_id)
                    s_obj = MainSection.objects.get(id=section_id)
                    cs_obj, _ = ClassSection.objects.get_or_create(class_ref=c_obj, section_ref=s_obj)
                    class_section_id = cs_obj.id
                else:
                    return Response(
                        {"error": "Provide either class_section_id OR both class_id and section_id"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            class_section = ClassSection.objects.filter(id=class_section_id).select_related('section_ref').first()
            if not class_section:
                return Response({"error": "Invalid class_section_id"}, status=status.HTTP_400_BAD_REQUEST)

            email = (data.get('email') or '').strip().lower()
            if email and User.objects.filter(email__iexact=email).exists():
                return Response({"error": "A student with this email already exists."}, status=status.HTTP_409_CONFLICT)

            first_name = (data.get('first_name') or '').strip()
            last_name = (data.get('last_name') or '').strip()
            father_contact = (data.get('father_contact') or '').strip()
            father_name = data.get('father_name')
            dob = data.get('dob')

            if school and first_name and last_name and father_contact and dob:
                duplicate_profile = StudentProfile.objects.filter(
                    school=school,
                    user__first_name__iexact=first_name,
                    user__last_name__iexact=last_name,
                    father_contact=father_contact,
                    dob=dob,
                ).exists()
                if duplicate_profile:
                    return Response(
                        {"error": "This student already exists. Please refresh the page before submitting again."},
                        status=status.HTTP_409_CONFLICT,
                    )

            roll_number = (data.get('roll_number') or '').strip() or _next_roll_number_for_class_section(class_section)

            admission_number = (data.get('admission_number') or '').strip()
            if admission_number and '-' in admission_number:
                admission_number = admission_number.split('-', 1)[1]

            rfid_val = data.get('rfid_code')
            if rfid_val is not None:
                rfid_val = str(rfid_val).strip()
                rfid_code_cleaned = rfid_val if rfid_val else None
            else:
                rfid_code_cleaned = None

            parent_obj = None
            if father_contact:
                parent_obj, _ = Parent.objects.get_or_create(
                    mobile=father_contact,
                    defaults={'name': father_name}
                )

            with transaction.atomic():
                user = User.objects.create_user(
                    username=get_unique_username(data['username']),
                    email=email or None,
                    password=data['password'],
                    # First/Last name are stored on the User model; `name` is kept for backward compatibility.
                    first_name=first_name,
                    last_name=last_name,
                    name=data.get('name') or f"{first_name} {last_name}".strip(),
                    role='student',
                    school=school
                )

                StudentProfile.objects.create(
                    user=user,
                    school=school,
                    admission_number=admission_number,
                    roll_number=roll_number,
                    rfid_code=rfid_code_cleaned,
                    class_section_id=class_section_id,
                    parent=parent_obj,
                    dob=dob,
                    gender=data.get('gender'),
                    blood_group=data.get('blood_group'),
                    father_name=father_name,
                    mother_name=data.get('mother_name'),
                    father_contact=father_contact,
                    mother_contact=data.get('mother_contact'),
                    bus_no=data.get('bus_no'),
                    address=data.get('address'),
                    date_of_admission=data.get('date_of_admission'),
                    category=data.get('category'),
                )
            return Response({"message": "Student created successfully"}, status=status.HTTP_201_CREATED)
        except IntegrityError:
            return Response(
                {"error": "A student with the same admission or roll number already exists. Please refresh and try again."},
                status=status.HTTP_409_CONFLICT,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
class StudentProfileView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        s = get_requested_student(request)
        if not s:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        from .serializers import StudentProfileSerializer
        serializer = StudentProfileSerializer(s, context={'request': request})
        data = serializer.data
        
        # Override admission_number to include school prefix
        if s.school:
             data["admission_number"] = f"{s.school.school_id}-{s.admission_number}"
        
        return Response(data)


_ALLOWED_PHOTO_CT = frozenset(
    {
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/octet-stream',  # some browsers; extension is still validated
    }
)


class StudentProfilePhotoView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if request.user.role != 'student':
            return Response(
                {"error": "Only students can update their profile photo"},
                status=status.HTTP_403_FORBIDDEN,
            )
        s = StudentProfile.objects.filter(user=request.user).first()
        if not s:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        f = request.FILES.get('photo')
        if not f:
            return Response({"error": "Send a file in field \"photo\""}, status=status.HTTP_400_BAD_REQUEST)

        ext = os.path.splitext(f.name or '')[1].lower()
        if ext not in ('.jpg', '.jpeg', '.png', '.webp', '.gif'):
            return Response({"error": "Allowed types: JPG, PNG, WebP, GIF"}, status=status.HTTP_400_BAD_REQUEST)

        ctype = (getattr(f, 'content_type', None) or '').lower()
        if ctype and ctype not in _ALLOWED_PHOTO_CT:
            return Response({"error": "Invalid image content type"}, status=status.HTTP_400_BAD_REQUEST)

        max_bytes = 4 * 1024 * 1024
        if getattr(f, 'size', 0) > max_bytes:
            return Response({"error": "Image must be 4MB or smaller"}, status=status.HTTP_400_BAD_REQUEST)

        if s.photo:
            s.photo.delete(save=False)
        s.photo = f
        s.save()

        photo_url = request.build_absolute_uri(s.photo.url)
        return Response({"message": "Photo saved", "photo_url": photo_url, "has_photo": True})

    def delete(self, request):
        if request.user.role != 'student':
            return Response(
                {"error": "Only students can update their profile photo"},
                status=status.HTTP_403_FORBIDDEN,
            )
        s = StudentProfile.objects.filter(user=request.user).first()
        if not s:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        if s.photo:
            s.photo.delete(save=False)
        s.photo = None
        s.save(update_fields=['photo'])
        return Response({"message": "Photo removed", "photo_url": None, "has_photo": False})


class StudentIdCardPdfView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != 'student':
            return Response(
                {"error": "Only students can view their ID card"},
                status=status.HTTP_403_FORBIDDEN,
            )
        s = (
            StudentProfile.objects.select_related(
                'user',
                'class_section__class_ref',
                'class_section__section_ref',
            )
            .filter(user=request.user)
            .first()
        )
        if not s:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        # Prefer the student's actual school so multi-school ID cards show correct branding.
        school_obj = getattr(request.user, 'school', None)
        if school_obj is None and s.class_section_id:
            school_obj = getattr(s.class_section, 'school', None)
        school_name = (
            getattr(school_obj, 'name', None)
            or getattr(settings, 'SCHOOL_NAME', 'School Management System')
        )
        pdf_bytes = build_student_id_card_pdf(
            s,
            school_name=school_name,
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
        filename = f"id-card-{s.admission_number or s.id}.pdf"
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        # Students are allowed to view only, not download.
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response

class SiblingListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != 'student':
            return Response({"error": "Only students can access this"}, status=status.HTTP_403_FORBIDDEN)
        
        student_profile = getattr(request.user, 'student_profile', None)
        if not student_profile:
            student_profile = StudentProfile.objects.filter(user=request.user).first()
            
        if not student_profile or not student_profile.parent:
            return Response([])

        siblings = StudentProfile.objects.filter(parent=student_profile.parent).select_related(
            'user', 'class_section__class_ref', 'class_section__section_ref'
        )
        
        return Response([
            {
                "id": s.id,
                "name": s.user.name or s.user.username,
                "class_name": f"{s.class_section.class_ref.name} - {s.class_section.section_ref.name}" if s.class_section else "N/A",
                "roll_number": s.roll_number,
                "admission_number": s.admission_number,
                "photo_url": request.build_absolute_uri(s.photo.url) if s.photo else None,
            }
            for s in siblings
        ])

class SiblingDashboardView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != 'student':
            return Response({"error": "Only students can access this dashboard"}, status=status.HTTP_403_FORBIDDEN)

        logged_in_student = StudentProfile.objects.filter(user=request.user).first()
        if not logged_in_student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        target_student_id = request.query_params.get('student_id')
        if target_student_id:
            try:
                target_student_id = int(target_student_id)
            except ValueError:
                return Response({"error": "Invalid student_id"}, status=status.HTTP_400_BAD_REQUEST)
        target_student = get_requested_student(request)
        if not target_student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        # Fetch all dashboard data for target_student
        
        # 1. Profile
        profile_data = {
            "id": target_student.id,
            "name": target_student.user.name or target_student.user.username,
            "admission_number": target_student.admission_number,
            "class_name": f"{target_student.class_section.class_ref.name} - {target_student.class_section.section_ref.name}" if target_student.class_section else "N/A",
            "class_section_display": f"{target_student.class_section.class_ref.name} - {target_student.class_section.section_ref.name}" if target_student.class_section else None,
            "photo_url": request.build_absolute_uri(target_student.photo.url) if target_student.photo else None,
        }

        # 2. Attendance
        attendance_qs = Attendance.objects.filter(student=target_student).order_by('-date')
        attendance_data = AttendanceSerializer(attendance_qs, many=True).data

        # 3. Results
        results_qs = Result.objects.filter(student=target_student).select_related('exam').order_by('-exam__date')
        results_data = [
            {
                "exam_id": r.exam.id,
                "exam_name": r.exam.name,
                "subject": r.subject,
                "marks": float(r.marks) if r.marks else 0,
                "max_marks": float(r.max_marks),
                "percentage": round((float(r.marks) / float(r.max_marks) * 100), 2) if r.marks and r.max_marks else 0,
                "grade": "A" if (float(r.marks or 0)/float(r.max_marks or 1)) > 0.8 else "B", # Simple logic for demo
                "result_status": "Pass" if (float(r.marks or 0)/float(r.max_marks or 1)) > 0.33 else "Fail",
            }
            for r in results_qs
        ]

        # 4. Fees
        fees_qs = StudentFee.objects.filter(student=target_student).select_related('fee_structure')
        fees_data = [
            {
                "id": f.id,
                "fee_type": f.fee_structure.class_ref.name,
                "total_amount": float(f.fee_structure.total_fees),
                "amount_paid": float(f.amount_paid),
                "due_amount": float(f.due_amount),
                "status": f.status,
                "due_date": f.due_date,
            }
            for f in fees_qs
        ]

        # 5. Assignments
        submissions = []
        if target_student.class_section:
            assignments_qs = Assignment.objects.filter(class_section=target_student.class_section).order_by('-due_date')
            submissions = Submission.objects.filter(student=target_student).values_list('assignment_id', flat=True)
            assignments_data = [
                {
                    "id": a.id,
                    "title": a.title,
                    "subject": a.subject,
                    "due_date": a.due_date,
                    "status": "Submitted" if a.id in submissions else "Pending",
                }
                for a in assignments_qs
            ]
        else:
            assignments_data = []

        # 6. Timetable
        if target_student.class_section:
            timetable_qs = TimeTableEntry.objects.filter(
                class_name=target_student.class_section.class_ref.name,
                section=target_student.class_section.section_ref.name
            )
            timetable_data = TimeTableEntrySerializer(timetable_qs, many=True).data
        else:
            timetable_data = []

        # 7. Communication / Notifications
        notices_qs = Notification.objects.filter(
            user=target_student.user
        ).order_by('-created_at')[:10]
        notices_data = NotificationSerializer(notices_qs, many=True).data

        # 8. Exams
        if target_student.class_section:
            exams_qs = Exam.objects.filter(class_section=target_student.class_section).order_by('-date')
            exams_data = [
                {
                    "id": e.id,
                    "name": e.name,
                    "date": e.date,
                    "exam_type": e.exam_type,
                    "status": e.status,
                }
                for e in exams_qs
            ]
        else:
            exams_data = []

        return Response({
            "profile": profile_data,
            "attendance": attendance_data,
            "results": results_data,
            "fees": fees_data,
            "assignments": assignments_data,
            "assignment_submissions": list(submissions),
            "timetable": timetable_data,
            "notifications": notices_data,
            "exams": exams_data,
        })


