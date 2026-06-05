import logging
from collections import defaultdict
from datetime import date
from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework import permissions, status, views
from rest_framework.response import Response

from core.permissions import IsAdmin, IsStudent, IsTeacher
from .models import Exam, ExamSchedule, Result, Marks, ResultStatus
from .serializers import (
    ExamScheduleSerializer, ExamSerializer, ResultSerializer,
    MarksSerializer, ResultStatusSerializer
)
from .pdf_marksheet import build_student_marksheet_pdf, _pct_to_grade
from django.conf import settings
from django.utils import timezone
from django.db.models import Count
from django.http import HttpResponse
from communication.models import Notification
from students.models import StudentProfile
from students.utils import get_requested_student
from subjects.models import Subject, TeacherAssignment
from classes.models import ClassSection

logger = logging.getLogger(__name__)


def _teacher_can_upload_subject_for_exam(user, class_section_id, subject_name: str) -> bool:
    if user.role != 'teacher':
        return True
    teacher_profile = getattr(user, 'teacher_profile', None)
    if not teacher_profile:
        return False
    # Identify subject in this class
    cs = ClassSection.objects.filter(id=class_section_id).first()
    if not cs:
        return False
    subject = Subject.objects.filter(
        class_ref_id=cs.class_ref_id,
        name=subject_name,
        status='Active',
    ).first()
    if not subject:
        return False
    # Accept explicit teacher assignment OR many-to-many subject teacher link.
    if TeacherAssignment.objects.filter(
        teacher=teacher_profile,
        class_ref_id=cs.class_ref_id,
        subject=subject,
    ).filter(Q(section_id=class_section_id) | Q(section__isnull=True)).exists():
        return True
    return subject.teachers.filter(id=teacher_profile.id).exists()


def _exam_class_label(exam):
    cs = getattr(exam, 'class_section', None)
    if not cs:
        return 'your class'
    try:
        return f"{cs.class_ref.name} - {cs.section_ref.name}"
    except Exception:
        return 'your class'


def _notify_class_students(class_section_id, title: str, message: str, related_exam=None):
    """Never raise — exam/schedule APIs must succeed even if notifications DB is out of date."""
    try:
        student_user_ids = list(
            StudentProfile.objects.filter(class_section_id=class_section_id).values_list('user_id', flat=True)
        )
        if not student_user_ids:
            return 0
        Notification.objects.bulk_create(
            [
                Notification(
                    user_id=uid,
                    target_role='student',
                    title=title,
                    message=message,
                    is_read=False,
                    related_exam=related_exam,
                )
                for uid in student_user_ids
            ]
        )
        return len(student_user_ids)
    except Exception:
        logger.exception('Failed to create student notifications (migrate communication app?)')
        return 0


class ExamListCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = Exam.objects.select_related('class_section__class_ref', 'class_section__section_ref').all()
        if request.user.role == 'student':
            student_profile = get_requested_student(request)
            if student_profile:
                qs = qs.filter(class_section=student_profile.class_section)
        class_section = request.query_params.get('class_section')
        if class_section:
            qs = qs.filter(class_section_id=class_section)
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        
        type_filter = request.query_params.get('type') or request.query_params.get('exam_type')
        if type_filter:
            qs = qs.filter(exam_type=type_filter)

        qs = qs.order_by('-start_date', '-id')
        return Response(ExamSerializer(qs, many=True).data)

    def post(self, request):
        if request.user.role not in ('admin', 'teacher'):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        serializer = ExamSerializer(data=request.data)
        if serializer.is_valid():
            exam = serializer.save()
            exam = Exam.objects.select_related('class_section__class_ref', 'class_section__section_ref').get(pk=exam.pk)
            if exam.start_date and exam.end_date:
                date_text = f"{exam.start_date} to {exam.end_date}"
            else:
                date_text = str(exam.start_date or exam.date or exam.end_date or 'TBA')
            class_label = _exam_class_label(exam)
            msg = (
                f"{exam.exam_type} — \"{exam.name}\" for {class_label}. "
                f"Dates: {date_text}. Tap View to open My Exams and see the timetable."
            )
            _notify_class_students(
                exam.class_section_id,
                title=f"New exam: {exam.name}",
                message=msg,
                related_exam=exam,
            )
            return Response(ExamSerializer(exam).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ExamDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, exam_id: int):
        if request.user.role not in ('admin', 'teacher'):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        exam = (
            Exam.objects.select_related('class_section__class_ref', 'class_section__section_ref')
            .filter(id=exam_id)
            .first()
        )
        if not exam:
            return Response({'error': 'Exam not found'}, status=status.HTTP_404_NOT_FOUND)
        old = {
            'name': exam.name,
            'start_date': exam.start_date,
            'end_date': exam.end_date,
            'exam_type': exam.exam_type,
            'class_section_id': exam.class_section_id,
        }
        serializer = ExamSerializer(exam, data=request.data, partial=True)
        if serializer.is_valid():
            exam = serializer.save()
            exam = Exam.objects.select_related('class_section__class_ref', 'class_section__section_ref').get(pk=exam.pk)
            changed = (
                old['name'] != exam.name
                or old['start_date'] != exam.start_date
                or old['end_date'] != exam.end_date
                or old['exam_type'] != exam.exam_type
                or old['class_section_id'] != exam.class_section_id
            )
            if changed:
                if exam.start_date and exam.end_date:
                    date_text = f"{exam.start_date} to {exam.end_date}"
                else:
                    date_text = str(exam.start_date or exam.date or exam.end_date or 'TBA')
                class_label = _exam_class_label(exam)
                msg = (
                    f"{exam.exam_type} — \"{exam.name}\" for {class_label} was updated. "
                    f"Dates: {date_text}. Check My Exams for details."
                )
                _notify_class_students(
                    exam.class_section_id,
                    title=f"Exam updated: {exam.name}",
                    message=msg,
                    related_exam=exam,
                )
            return Response(ExamSerializer(exam).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, exam_id: int):
        if request.user.role != 'admin':
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        exam = Exam.objects.filter(id=exam_id).first()
        if not exam:
            return Response({'error': 'Exam not found'}, status=status.HTTP_404_NOT_FOUND)
        exam.delete()
        return Response({'message': 'Exam deleted successfully'})


def _time_overlap(start_a, end_a, start_b, end_b):
    return start_a < end_b and start_b < end_a


class ExamScheduleListCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, exam_id: int):
        exam = Exam.objects.filter(id=exam_id).first()
        if not exam:
            return Response({'error': 'Exam not found'}, status=status.HTTP_404_NOT_FOUND)
        rows = ExamSchedule.objects.filter(exam_id=exam_id).order_by('exam_date', 'start_time')
        return Response(ExamScheduleSerializer(rows, many=True).data)

    def post(self, request, exam_id: int):
        if request.user.role not in ('admin', 'teacher'):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        exam = Exam.objects.select_related('class_section').filter(id=exam_id).first()
        if not exam:
            return Response({'error': 'Exam not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ExamScheduleSerializer(data={**request.data, 'exam': exam_id})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        validated = serializer.validated_data

        exam_date = validated['exam_date']
        start_time = validated['start_time']
        end_time = validated['end_time']
        if end_time <= start_time:
            return Response({'error': 'end_time must be after start_time'}, status=status.HTTP_400_BAD_REQUEST)

        # Validation: no clash for same class on same date
        clashes = (
            ExamSchedule.objects.select_related('exam')
            .filter(
                exam__class_section_id=exam.class_section_id,
                exam_date=exam_date,
            )
            .exclude(exam_id=exam.id)
        )
        for c in clashes:
            if _time_overlap(start_time, end_time, c.start_time, c.end_time):
                return Response(
                    {'error': f'Time clash with another exam schedule ({c.exam.name} - {c.subject})'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            row = serializer.save()
        except IntegrityError:
            return Response(
                {'error': 'This subject is already on the timetable for this exam. Pick another subject or edit the existing row.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exam = Exam.objects.select_related('class_section__class_ref', 'class_section__section_ref').get(pk=exam.pk)
        class_label = _exam_class_label(exam)
        _notify_class_students(
            exam.class_section_id,
            title=f"Timetable: {exam.name}",
            message=(
                f"{exam.exam_type} | {class_label} | {row.subject} on {row.exam_date} "
                f"({row.start_time.strftime('%H:%M')}–{row.end_time.strftime('%H:%M')}). "
                f"See My Exams for full schedule."
            ),
            related_exam=exam,
        )
        return Response(ExamScheduleSerializer(row).data, status=status.HTTP_201_CREATED)


class ExamScheduleDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, schedule_id: int):
        if request.user.role not in ('admin', 'teacher'):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        row = ExamSchedule.objects.select_related('exam').filter(id=schedule_id).first()
        if not row:
            return Response({'error': 'Schedule not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ExamScheduleSerializer(row, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        row = serializer.save()

        if row.end_time <= row.start_time:
            return Response({'error': 'end_time must be after start_time'}, status=status.HTTP_400_BAD_REQUEST)

        clashes = (
            ExamSchedule.objects.select_related('exam')
            .filter(
                exam__class_section_id=row.exam.class_section_id,
                exam_date=row.exam_date,
            )
            .exclude(id=row.id)
            .exclude(exam_id=row.exam_id)
        )
        for c in clashes:
            if _time_overlap(row.start_time, row.end_time, c.start_time, c.end_time):
                return Response(
                    {'error': f'Time clash with another exam schedule ({c.exam.name} - {c.subject})'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        exam = row.exam
        exam = Exam.objects.select_related('class_section__class_ref', 'class_section__section_ref').get(pk=exam.pk)
        class_label = _exam_class_label(exam)
        _notify_class_students(
            exam.class_section_id,
            title=f"Timetable updated: {exam.name}",
            message=(
                f"{exam.exam_type} | {class_label} | {row.subject} on {row.exam_date} "
                f"({row.start_time.strftime('%H:%M')}–{row.end_time.strftime('%H:%M')})."
            ),
            related_exam=exam,
        )
        return Response(ExamScheduleSerializer(row).data)

    def delete(self, request, schedule_id: int):
        if request.user.role not in ('admin', 'teacher'):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        row = ExamSchedule.objects.filter(id=schedule_id).first()
        if not row:
            return Response({'error': 'Schedule not found'}, status=status.HTTP_404_NOT_FOUND)
        row.delete()
        return Response({'message': 'Schedule deleted'})


class ResultUploadView(views.APIView):
    permission_classes = [IsTeacher | IsAdmin]

    def get(self, request):
        teacher_profile = getattr(request.user, 'teacher_profile', None)
        if not teacher_profile and request.user.role != 'admin':
            return Response([])

        qs = Marks.objects.select_related(
            'student__user',
            'subject',
            'class_section__class_ref',
            'class_section__section_ref',
            'uploaded_by__user'
        ).all()

        if request.user.role == 'teacher':
            qs = qs.filter(uploaded_by=teacher_profile)

        # Filters
        class_section = request.query_params.get('class_section')
        if class_section:
            qs = qs.filter(class_section_id=class_section)
        
        exam_type = request.query_params.get('exam_type')
        if exam_type:
            qs = qs.filter(exam_type=exam_type)

        qs = qs.order_by('-updated_at')
        return Response(MarksSerializer(qs, many=True).data)

    def post(self, request):
        payload = request.data
        # {exam, class_section, subject, exam_type, max_marks, entries:[{student, marks, absent}]}
        if isinstance(payload, dict) and isinstance(payload.get('entries'), list):
            exam_id = payload.get('exam')
            class_section_id = payload.get('class_section')
            subject_name = (payload.get('subject') or '').strip()
            # If exam_id is provided, we can infer class and type if they are missing
            exam_type = payload.get('exam_type')
            if not exam_type and exam_id:
                exam = Exam.objects.filter(id=exam_id).first()
                if exam:
                    exam_type = exam.exam_type.lower().replace(' ', '_')
            
            if not class_section_id or not subject_name or not exam_type:
                return Response(
                    {"error": "class_section, subject and exam_type are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Locking check
            status_obj = ResultStatus.objects.filter(class_section_id=class_section_id, exam_type=exam_type).first()
            is_internal = exam_type in ['unit_test', 'class_test']
            if status_obj and status_obj.is_published and not is_internal:
                return Response({"error": "Results are published and locked. Contact Admin to unpublish first."}, status=status.HTTP_400_BAD_REQUEST)

            if request.user.role == 'teacher' and not _teacher_can_upload_subject_for_exam(request.user, class_section_id, subject_name):
                return Response({"error": "You can upload marks only for your assigned subject"}, status=status.HTTP_403_FORBIDDEN)

            max_marks_raw = payload.get('max_marks')
            try:
                max_marks = float(str(max_marks_raw))
            except (ValueError, TypeError):
                max_marks = 100.0

            entries = payload.get('entries') or []
            # Improved Lookup: Must filter by BOTH name and class_ref_id to avoid cross-class data leaks.
            class_section = ClassSection.objects.filter(id=class_section_id).first()
            if not class_section:
                return Response({"error": "Class section not found"}, status=status.HTTP_404_NOT_FOUND)
                
            subject_obj = Subject.objects.filter(name=subject_name, class_ref_id=class_section.class_ref_id).first()
            teacher_profile = getattr(request.user, 'teacher_profile', None)

            errors = []
            parsed = []
            for idx, entry in enumerate(entries):
                student_id = entry.get('student')
                marks_val = entry.get('marks')
                try:
                    marks_val = float(str(marks_val))
                    if marks_val < 0 or marks_val > max_marks:
                        errors.append({"index": idx, "error": f"Marks must be between 0 and {max_marks}"})
                        continue
                except (ValueError, TypeError):
                    errors.append({"index": idx, "error": "Invalid marks"})
                    continue
                parsed.append((student_id, marks_val))

            if errors:
                return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                for student_id, marks_val in parsed:
                    Marks.objects.update_or_create(
                        student_id=student_id,
                        subject=subject_obj,
                        class_section_id=class_section_id,
                        exam_type=exam_type,
                        defaults={
                            "marks": marks_val,
                            "max_marks": max_marks,
                            "is_uploaded": True,
                            "uploaded_by": teacher_profile
                        }
                    )
            return Response({"message": "Marks uploaded successfully"}, status=status.HTTP_201_CREATED)

        return Response({"error": "Invalid payload format"}, status=status.HTTP_400_BAD_REQUEST)


class ExamResultDashboardView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, exam_id: int):
        student_id = request.query_params.get('student_id')
        exam = Exam.objects.select_related('class_section').filter(id=exam_id).first()
        if not exam:
            return Response({'error': 'Exam not found'}, status=status.HTTP_404_NOT_FOUND)

        exam_type_slug = exam.exam_type.lower().replace(' ', '_')
        qs = Marks.objects.select_related('student__user', 'subject').filter(
            class_section=exam.class_section,
            exam_type=exam_type_slug
        )
        if request.user.role == 'student':
            student = get_requested_student(request)
            qs = qs.filter(student=student)
        elif student_id:
            qs = qs.filter(student_id=student_id)

        grouped = defaultdict(list)
        for r in qs:
            grouped[r.student_id].append(r)

        rows = []
        for sid, marks_rows in grouped.items():
            student_name = marks_rows[0].student.user.name or marks_rows[0].student.user.username
            total_obtained = 0.0
            total_max = 0.0
            subject_rows = []
            for m in marks_rows:
                total_obtained += m.marks
                total_max += m.max_marks
                subject_rows.append(MarksSerializer(m).data)

            pct = (total_obtained / total_max * 100) if total_max > 0 else 0.0
            grade = _pct_to_grade(pct)
            status_text = 'Pass' if total_obtained >= float(exam.passing_marks) else 'Fail'

            rows.append({
                'student_id': sid,
                'student_name': student_name,
                'total_marks': total_max,
                'obtained_marks': total_obtained,
                'percentage': round(pct, 2),
                'grade': grade,
                'status': status_text,
                'subjects': subject_rows,
            })
        return Response(rows)


class PublishResultView(views.APIView):
    permission_classes = [IsTeacher | IsAdmin]

    def post(self, request, exam_id: int):
        exam = Exam.objects.select_related('class_section').filter(id=exam_id).first()
        if not exam:
            return Response({'error': 'Exam not found'}, status=status.HTTP_404_NOT_FOUND)
        
        exam_type_slug = exam.exam_type.lower().replace(' ', '_')
        publish = request.data.get('publish', True)

        # Role-based restriction: Teachers can only publish unit_test and class_test
        if request.user.role == 'teacher':
            allowed_types = ['unit_test', 'class_test']
            if exam_type_slug not in allowed_types:
                return Response(
                    {'error': 'Teachers can only publish Unit and Class Tests. MST and Final Exam results must be published by the Admin.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        if publish:
            rows, all_submitted = _compute_exam_subject_status(exam.class_section_id, exam_type_slug)
            is_internal = exam_type_slug in ['unit_test', 'class_test']
            if not all_submitted and not is_internal:
                return Response(
                    {'error': 'All subjects must be submitted for all students before publishing. Internal tests (Unit/Class) can be published subject-wise.', 'subjects': rows},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        
        # Update or create ResultStatus
        res_status, created = ResultStatus.objects.update_or_create(
            class_section=exam.class_section,
            exam_type=exam_type_slug,
            defaults={
                'is_published': publish,
                'published_at': timezone.now() if publish else None,
                'published_by': request.user
            }
        )
        
        # Also lock the individual marks if publishing
        if publish:
            Marks.objects.filter(class_section=exam.class_section, exam_type=exam_type_slug).update(is_locked=True)
            
            # Send notifications
            _notify_class_students(
                exam.class_section_id,
                title='Result Published',
                message=f'Your {exam.exam_type} result has been published. Please check your result.',
                related_exam=exam,
            )
        
        return Response({
            'message': 'Result publish status updated',
            'is_published': res_status.is_published,
            'exam_type': exam_type_slug
        })

    def put(self, request, exam_id: int):
        return self.post(request, exam_id)


def _compute_exam_subject_status(class_section_id: int, exam_type: str):
    # Get all active subjects for this class
    class_section = ClassSection.objects.get(id=class_section_id)
    class_obj = class_section.class_ref
    subjects = Subject.objects.filter(class_ref=class_obj, status='Active').prefetch_related('teachers__user')
    
    total_students = StudentProfile.objects.filter(class_section_id=class_section_id).count()
    
    rows = []
    all_submitted = True
    
    for sub in subjects:
        # Count unique students who have marks for this subject and exam_type
        submitted_count = Marks.objects.filter(
            class_section_id=class_section_id,
            exam_type=exam_type,
            subject=sub
        ).values('student').distinct().count()
        
        is_submitted = (total_students > 0 and submitted_count >= total_students)
        if not is_submitted:
            all_submitted = False
        
        # Determine responsible teachers dynamically
        # 1. Check specific TeacherAssignment
        responsible_teachers = list(TeacherAssignment.objects.filter(
            subject=sub,
            class_ref=class_obj
        ).filter(Q(section_id=class_section_id) | Q(section__isnull=True)).values_list('teacher__user__name', flat=True))
        
        # 2. Fallback to Subject.teachers M2M if no specific assignments
        if not responsible_teachers:
            responsible_teachers = [t.user.name or t.user.username for t in sub.teachers.all()]
            
        rows.append({
            "subject": sub.name,
            "status": "Submitted" if is_submitted else "Pending",
            "submitted_students": submitted_count,
            "total_students": total_students,
            "assigned_teachers": ", ".join(responsible_teachers) if responsible_teachers else "Not Assigned"
        })
        
    return rows, all_submitted


class ExamSubjectStatusView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, exam_id: int):
        exam = Exam.objects.select_related('class_section__class_ref').filter(id=exam_id).first()
        if not exam:
            return Response({'error': 'Exam not found'}, status=status.HTTP_404_NOT_FOUND)
        
        exam_type_slug = exam.exam_type.lower().replace(' ', '_')
        rows, all_submitted = _compute_exam_subject_status(exam.class_section_id, exam_type_slug)
        
        # Check if actually published in ResultStatus
        res_status = ResultStatus.objects.filter(class_section=exam.class_section, exam_type=exam_type_slug).first()
        is_published = res_status.is_published if res_status else False

        return Response(
            {
                "exam_id": exam.id,
                "exam_name": exam.name,
                "exam_type": exam.exam_type,
                "class_name": exam.class_section.class_ref.name,
                "is_published": is_published,
                "subjects": rows,
                "all_submitted": all_submitted,
            }
        )


class ExamDetailedStatusView(views.APIView):
    """
    Returns a matrix of Student -> Subject -> Completion Status for a specific exam.
    Used by admins to monitor progress before publishing.
    """
    permission_classes = [IsAdmin]

    def get(self, request, exam_id: int):
        exam = Exam.objects.select_related('class_section__class_ref').filter(id=exam_id).first()
        if not exam:
            return Response({'error': 'Exam not found'}, status=status.HTTP_404_NOT_FOUND)
        
        exam_type_slug = exam.exam_type.lower().replace(' ', '_')
        class_section = exam.class_section
        
        # Get active subjects for this class
        subjects = Subject.objects.filter(class_ref=class_section.class_ref, status='Active').order_by('name')
        subject_data = [{"id": s.id, "name": s.name} for s in subjects]
        
        # Get students
        students = StudentProfile.objects.select_related('user').filter(class_section=class_section).order_by('user__name')
        
        # Get marks lookup
        marks_lookup = set(
            Marks.objects.filter(class_section=class_section, exam_type=exam_type_slug)
            .values_list('student_id', 'subject_id')
        )
        
        matrix = []
        for student in students:
            student_subjects = []
            for sub in subjects:
                student_subjects.append({
                    "subject_id": sub.id,
                    "is_submitted": (student.id, sub.id) in marks_lookup
                })
            
            matrix.append({
                "student_id": student.id,
                "student_name": student.user.name or student.user.username,
                "roll_number": student.roll_number,
                "submissions": student_subjects
            })

        return Response({
            "exam_id": exam.id,
            "exam_name": exam.name,
            "subjects": subject_data,
            "matrix": matrix
        })


class TeacherExamSubjectsView(views.APIView):
    permission_classes = [IsTeacher | IsAdmin]

    def get(self, request, exam_id: int):
        exam = Exam.objects.select_related('class_section__class_ref').filter(id=exam_id).first()
        if not exam:
            return Response({'error': 'Exam not found'}, status=status.HTTP_404_NOT_FOUND)
        class_ref_id = exam.class_section.class_ref_id
        if request.user.role == 'admin':
            subjects = list(
                Subject.objects.filter(class_ref_id=class_ref_id, status='Active').values('id', 'name').order_by('name')
            )
            return Response(subjects)

        teacher_profile = getattr(request.user, 'teacher_profile', None)
        if not teacher_profile:
            return Response([], status=status.HTTP_200_OK)
        subject_ids = set(
            TeacherAssignment.objects.filter(
                teacher=teacher_profile,
                class_ref_id=class_ref_id,
            )
            .filter(Q(section_id=exam.class_section_id) | Q(section__isnull=True))
            .values_list('subject_id', flat=True)
        )
        if not subject_ids:
            subject_ids = set(
                Subject.objects.filter(
                    class_ref_id=class_ref_id,
                    teachers=teacher_profile,
                    status='Active',
                ).values_list('id', flat=True)
            )
        subjects = list(Subject.objects.filter(id__in=subject_ids).values('id', 'name').order_by('name'))
        return Response(subjects)


class ClassSectionTeacherSubjectsView(views.APIView):
    permission_classes = [IsTeacher | IsAdmin]

    def get(self, request, class_section_id: int):
        cs = ClassSection.objects.select_related('class_ref').filter(id=class_section_id).first()
        if not cs:
            return Response({'error': 'Class section not found'}, status=status.HTTP_404_NOT_FOUND)
        class_ref_id = cs.class_ref_id
        if request.user.role == 'admin':
            subjects = list(
                Subject.objects.filter(class_ref_id=class_ref_id, status='Active').values('id', 'name').order_by('name')
            )
            return Response(subjects)

        teacher_profile = getattr(request.user, 'teacher_profile', None)
        if not teacher_profile:
            return Response([], status=status.HTTP_200_OK)
        subject_ids = set(
            TeacherAssignment.objects.filter(
                teacher=teacher_profile,
                class_ref_id=class_ref_id,
            )
            .filter(Q(section_id=class_section_id) | Q(section__isnull=True))
            .values_list('subject_id', flat=True)
        )
        if not subject_ids:
            subject_ids = set(
                Subject.objects.filter(
                    class_ref_id=class_ref_id,
                    teachers=teacher_profile,
                    status='Active',
                ).values_list('id', flat=True)
            )
        subjects = list(Subject.objects.filter(id__in=subject_ids).values('id', 'name').order_by('name'))
        return Response(subjects)


class MyResultsView(views.APIView):
    permission_classes = [IsStudent]

    def get(self, request):
        profile = get_requested_student(request)
        if not profile:
            return Response([])
        
        # Get published exam types for this class
        published_types = ResultStatus.objects.filter(
            class_section=profile.class_section,
            is_published=True
        ).values_list('exam_type', flat=True)
        
        if not published_types:
            return Response([])

        # Fetch marks only for published exam types
        marks = Marks.objects.select_related('subject').filter(
            student=profile,
            exam_type__in=published_types
        ).order_by('exam_type', 'subject__name')
        
        serializer = MarksSerializer(marks, many=True)
        return Response(serializer.data)


class MyResultMarksheetPDFView(views.APIView):
    permission_classes = [IsStudent]

    def get(self, request, exam_id: int):
        exam = Exam.objects.select_related('class_section').filter(id=exam_id).first()
        if not exam:
            return Response({'error': 'Exam not found'}, status=status.HTTP_404_NOT_FOUND)

        exam_type_slug = exam.exam_type.lower().replace(' ', '_')
        profile = get_requested_student(request)
        if not profile:
            return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check if published
        res_status = ResultStatus.objects.filter(class_section=profile.class_section, exam_type=exam_type_slug, is_published=True).first()
        if not res_status:
            return Response({'error': 'Results for this exam are not published yet'}, status=status.HTTP_403_FORBIDDEN)

        student_marks = Marks.objects.select_related('subject').filter(
            student=profile,
            class_section=profile.class_section,
            exam_type=exam_type_slug
        ).order_by('subject__name')

        if not student_marks.exists():
            return Response({'error': 'No marks found for this exam'}, status=status.HTTP_404_NOT_FOUND)

        total_max = 0.0
        total_obt = 0.0
        subject_rows = []
        passing_marks = float(exam.passing_marks or 0)

        for m in student_marks:
            total_max += m.max_marks
            total_obt += m.marks
            
            pct = (m.marks / m.max_marks * 100.0) if m.max_marks > 0 else 0.0
            grade = _pct_to_grade(pct)
            result_text = 'Pass' if m.marks >= (passing_marks / len(student_marks)) else 'Pass' # Simplification
            # Realistically pass/fail is usually based on subject-wise passing or total.
            # Here we follow existing logic style.

            subject_rows.append({
                'subject': m.subject.name,
                'max_marks': m.max_marks,
                'marks': m.marks,
                'grade': grade,
                'result': 'Pass' if m.marks >= (m.max_marks * 0.33) else 'Fail' # Standard 33% pass
            })

        percentage = (total_obt / total_max * 100.0) if total_max > 0 else 0.0
        overall_grade = _pct_to_grade(percentage)
        final_result = 'Pass' if total_obt >= passing_marks else 'Fail'

        academic_year = f"{exam.start_date.year}" if exam.start_date else '—'
        class_label = f"{profile.class_section.class_ref.name}-{profile.class_section.section_ref.name}"
        school_name = getattr(settings, 'SCHOOL_NAME', 'School Management System')
        declaration_date = str(res_status.published_at.date()) if res_status.published_at else str(timezone.now().date())

        pdf_bytes = build_student_marksheet_pdf(
            school_name=school_name,
            student_name=request.user.name or request.user.username,
            roll_number=str(profile.admission_number or ''),
            class_label=class_label,
            academic_year=academic_year,
            exam_type=exam.exam_type,
            declaration_date=declaration_date,
            total_obtained=total_obt,
            total_max=total_max,
            percentage=percentage,
            overall_grade=overall_grade,
            final_result=final_result,
            subject_rows=subject_rows,
            class_teacher_name='—',
            remarks='—',
        )
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="marksheet_exam_{exam_id}.pdf"'
        return response
