from collections import defaultdict
import calendar
from datetime import date as date_type
from datetime import timedelta, datetime as datetime_type

from django.db import transaction
from django.db.models import Q
from rest_framework import status, views, permissions
from rest_framework.response import Response
from .models import Attendance
from .serializers import AttendanceSerializer
from core.permissions import IsTeacher, IsStudent
from communication.models import Notification
from holidays.models import Holiday
from timetable.models import TimeTableEntry
from .pdf_report import build_student_attendance_report_pdf
from django.http import HttpResponse
from classes.models import ClassSection
from classes.teacher_access import teacher_teaches_class_section, teacher_can_mark_attendance
from students.models import StudentProfile
from students.utils import get_requested_student
from django.utils import timezone

class AttendanceMarkView(views.APIView):
    """
    Teacher can POST attendance for individual students.
    """
    permission_classes = [IsTeacher]

    def post(self, request):
        student_id = request.data.get('student')
        date_raw = request.data.get('date')
        status_value = (request.data.get('status') or '').lower()

        if not student_id or not date_raw or status_value not in ('present', 'absent'):
            return Response({'error': 'student, date and status(present/absent) are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_date = date_type.fromisoformat(date_raw)
        except Exception:
            return Response({'error': 'Invalid date format'}, status=status.HTTP_400_BAD_REQUEST)

        if target_date != timezone.localdate():
            return Response(
                {'error': 'Attendance can only be edited for today. Past dates are view-only.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        student = StudentProfile.objects.select_related('class_section').filter(id=student_id).first()
        if not student or not student.class_section:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

        if not teacher_can_mark_attendance(request.user.teacher_profile, student.class_section):
            return Response({'error': 'Only Class Teachers can mark attendance for this class section.'}, status=status.HTTP_403_FORBIDDEN)

        verification_status = 'approved' if status_value == 'present' else 'rejected'
        attendance, _ = Attendance.objects.update_or_create(
            student=student,
            date=target_date,
            defaults={
                'status': status_value,
                'marked_by': request.user.teacher_profile,
                'marked_via': 'manual',
                'verification_status': verification_status,
                'verified_by': request.user.teacher_profile,
                'verified_at': timezone.now(),
                'punch_time': None,
            },
        )
        return Response(AttendanceSerializer(attendance).data, status=status.HTTP_200_OK)


class TeacherAttendanceSheetView(views.APIView):
    """
    Teacher attendance sheet by class+date (manual P/A flow).
    """

    permission_classes = [IsTeacher]

    def get(self, request):
        class_section_id = request.query_params.get('class_section_id')
        date_raw = request.query_params.get('date')
        if not class_section_id:
            return Response({'error': 'class_section_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            class_section_id = int(class_section_id)
        except Exception:
            return Response({'error': 'Invalid class_section_id'}, status=status.HTTP_400_BAD_REQUEST)

        target_date = date_type.today()
        if date_raw:
            try:
                target_date = date_type.fromisoformat(date_raw)
            except Exception:
                return Response({'error': 'Invalid date format'}, status=status.HTTP_400_BAD_REQUEST)

        class_section = (
            ClassSection.objects.select_related('class_ref', 'section_ref', 'class_teacher__user')
            .filter(id=class_section_id)
            .first()
        )
        if not class_section:
            return Response({'error': 'Class section not found'}, status=status.HTTP_404_NOT_FOUND)
        if not teacher_teaches_class_section(request.user.teacher_profile, class_section):
            return Response({'error': 'Not allowed for this class section'}, status=status.HTTP_403_FORBIDDEN)

        students = list(
            StudentProfile.objects.select_related('user')
            .filter(class_section_id=class_section_id)
            .order_by('id')
        )
        student_ids = [s.id for s in students]

        records = Attendance.objects.filter(student_id__in=student_ids, date=target_date)
        rec_by_student = {r.student_id: r for r in records}

        rows = []
        present = 0
        absent = 0
        marked = 0
        for idx, s in enumerate(students, start=1):
            rec = rec_by_student.get(s.id)
            st = rec.status if rec else None
            if st in ('present', 'absent'):
                marked += 1
                if st == 'present':
                    present += 1
                else:
                    absent += 1
            rows.append(
                {
                    'student_id': s.id,
                    'name': s.user.name or s.user.username,
                    'roll_no': s.roll_number or s.admission_number or str(idx),
                    'status': st,
                }
            )

        is_editable = target_date == timezone.localdate()
        can_mark = teacher_can_mark_attendance(request.user.teacher_profile, class_section)

        return Response(
            {
                'class_section_id': class_section.id,
                'class_display': f'{class_section.class_ref.name} - {class_section.section_ref.name}',
                'date': target_date.isoformat(),
                'is_editable': is_editable,
                'can_mark': can_mark,
                'summary': {
                    'present': present,
                    'absent': absent,
                    'marked': marked,
                    'total_students': len(students),
                },
                'students': rows,
            }
        )


class TeacherAttendanceBulkSaveView(views.APIView):
    """
    Save class attendance in bulk (P/A only), one record per student per day.
    Upsert behavior enables same-day edit while preventing duplicates.
    """

    permission_classes = [IsTeacher]

    def post(self, request):
        class_section_id = request.data.get('class_section_id')
        date_raw = request.data.get('date')
        rows = request.data.get('rows') or []

        if not class_section_id or not date_raw or not isinstance(rows, list):
            return Response({'error': 'class_section_id, date and rows[] are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            class_section_id = int(class_section_id)
            target_date = date_type.fromisoformat(str(date_raw))
        except Exception:
            return Response({'error': 'Invalid class_section_id/date'}, status=status.HTTP_400_BAD_REQUEST)

        if target_date != timezone.localdate():
            return Response(
                {'error': 'Past attendance records are view-only. You can edit attendance only for today.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        class_section = (
            ClassSection.objects.select_related('class_ref', 'section_ref', 'class_teacher__user')
            .filter(id=class_section_id)
            .first()
        )
        if not class_section:
            return Response({'error': 'Class section not found'}, status=status.HTTP_404_NOT_FOUND)
        if not teacher_can_mark_attendance(request.user.teacher_profile, class_section):
            return Response({'error': 'Only Class Teachers can save attendance in bulk for this class section.'}, status=status.HTTP_403_FORBIDDEN)

        student_ids = set(
            StudentProfile.objects.filter(class_section_id=class_section_id).values_list('id', flat=True)
        )

        save_count = 0
        with transaction.atomic():
            for row in rows:
                try:
                    sid = int(row.get('student_id'))
                except Exception:
                    continue
                status_value = (row.get('status') or '').lower()
                if sid not in student_ids:
                    continue
                if status_value not in ('present', 'absent'):
                    continue
                verification_status = 'approved' if status_value == 'present' else 'rejected'
                Attendance.objects.update_or_create(
                    student_id=sid,
                    date=target_date,
                    defaults={
                        'status': status_value,
                        'marked_by': request.user.teacher_profile,
                        'marked_via': 'manual',
                        'verification_status': verification_status,
                        'verified_by': request.user.teacher_profile,
                        'verified_at': timezone.now(),
                        'punch_time': None,
                    },
                )
                save_count += 1

        if save_count == 0:
            return Response(
                {'error': 'No attendance was saved. Please mark at least one student as Present or Absent.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({'message': 'Attendance saved', 'saved': save_count}, status=status.HTTP_200_OK)


class StudentPunchAttendanceView(views.APIView):
    """
    Student punches attendance from biometric/RFID machine.
    Creates Attendance with:
      - verification_status='pending'
      - punch_time (server time by default)
      - status='present' as placeholder until teacher verifies
    """

    permission_classes = [IsStudent]

    def post(self, request):
        student_profile = get_requested_student(request)
        if not student_profile:
            return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

        date_raw = request.data.get('date')
        target_date = date_type.today()
        if date_raw:
            try:
                target_date = date_type.fromisoformat(date_raw)
            except Exception:
                return Response({'error': 'Invalid date'}, status=status.HTTP_400_BAD_REQUEST)

        punch_time_raw = request.data.get('punch_time')
        if punch_time_raw:
            try:
                punch_dt = datetime_type.fromisoformat(str(punch_time_raw))
                if timezone.is_naive(punch_dt):
                    punch_dt = timezone.make_aware(punch_dt)
            except Exception:
                punch_dt = timezone.now()
        else:
            punch_dt = timezone.now()

        attendance, created = Attendance.objects.select_related('student').get_or_create(
            student=student_profile,
            date=target_date,
            defaults={
                'status': 'present',
                'verification_status': 'pending',
                'marked_via': 'rfid',
                'punch_time': punch_dt,
            },
        )

        if not created and attendance.verification_status != 'pending':
            return Response({'error': 'Attendance already verified for this date'}, status=status.HTTP_409_CONFLICT)

        # If already pending, allow updating punch_time (e.g., multiple punches).
        attendance.status = 'present'
        attendance.verification_status = 'pending'
        attendance.marked_via = 'rfid'
        attendance.punch_time = punch_dt
        attendance.marked_by = None
        attendance.verified_by = None
        attendance.verified_at = None
        attendance.save()

        # Notify assigned class teacher to verify (only on first record creation).
        if created:
            class_section = student_profile.class_section
            if class_section and class_section.class_teacher:
                teacher_user = class_section.class_teacher.user
                Notification.objects.create(
                    user=teacher_user,
                    target_role=teacher_user.role,
                    title='Attendance Verification Pending',
                    message=f"{student_profile.user.name or student_profile.user.username} punched attendance for {target_date.isoformat()}. Please verify (Approve/Reject).",
                    is_read=False,
                )

        return Response(AttendanceSerializer(attendance).data, status=status.HTTP_201_CREATED)


class TeacherAttendanceVerificationListView(views.APIView):
    """
    Teacher panel list for a date and class_section.
    """

    permission_classes = [IsTeacher]

    def get(self, request):
        class_section_id = request.query_params.get('class_section_id')
        date_raw = request.query_params.get('date')
        if not class_section_id:
            return Response({'error': 'class_section_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            class_section_id_int = int(class_section_id)
        except Exception:
            return Response({'error': 'Invalid class_section_id'}, status=status.HTTP_400_BAD_REQUEST)

        target_date = date_type.today()
        if date_raw:
            try:
                target_date = date_type.fromisoformat(date_raw)
            except Exception:
                return Response({'error': 'Invalid date format'}, status=status.HTTP_400_BAD_REQUEST)

        class_section = (
            ClassSection.objects.select_related('class_ref', 'section_ref', 'class_teacher__user')
            .filter(id=class_section_id_int)
            .first()
        )
        if not class_section:
            return Response({'error': 'Class section not found'}, status=status.HTTP_404_NOT_FOUND)

        if not teacher_teaches_class_section(request.user.teacher_profile, class_section):
            return Response({'error': 'Not allowed for this class section'}, status=status.HTTP_403_FORBIDDEN)

        students = (
            StudentProfile.objects.select_related('user')
            .filter(class_section_id=class_section_id_int)
            .order_by('id')
        )
        student_ids = [s.id for s in students]

        records = (
            Attendance.objects.filter(student_id__in=student_ids, date=target_date)
            .select_related('student')
        )
        rec_by_student = {r.student_id: r for r in records}

        pending = 0
        approved = 0
        rejected = 0

        rows = []
        for s in students:
            rec = rec_by_student.get(s.id)
            v = rec.verification_status if rec else None
            if v == 'pending':
                pending += 1
            elif v == 'approved':
                approved += 1
            elif v == 'rejected':
                rejected += 1

            rows.append(
                {
                    'student_id': s.id,
                    'id': s.id,
                    'admission_number': s.admission_number,
                    'name': s.user.name or s.user.username,
                    'punch_time': rec.punch_time.isoformat() if rec and rec.punch_time else None,
                    'attendance_id': rec.id if rec else None,
                    'verification_status': v,
                    'status': v,  # for UI convenience (pending/approved/rejected)
                }
            )

        return Response(
            {
                'class_section_id': class_section.id,
                'class_display': f'{class_section.class_ref.name} - {class_section.section_ref.name}',
                'date': target_date.isoformat(),
                'summary': {'pending': pending, 'approved': approved, 'rejected': rejected, 'total_students': len(student_ids)},
                'students': rows,
            }
        )


class TeacherAttendanceVerificationDecisionView(views.APIView):
    """
    Approve or Reject a pending attendance record.
    """

    permission_classes = [IsTeacher]

    def patch(self, request, attendance_id: int):
        try:
            attendance_id_int = int(attendance_id)
        except Exception:
            return Response({'error': 'Invalid attendance_id'}, status=status.HTTP_400_BAD_REQUEST)

        decision = (request.data.get('decision') or '').lower()
        if decision not in ('approve', 'reject'):
            return Response({'error': 'decision must be approve or reject'}, status=status.HTTP_400_BAD_REQUEST)

        attendance = Attendance.objects.select_related('student__class_section__class_teacher__user', 'student__user').filter(id=attendance_id_int).first()
        if not attendance:
            return Response({'error': 'Attendance not found'}, status=status.HTTP_404_NOT_FOUND)

        class_section = attendance.student.class_section
        if not class_section:
            return Response({'error': 'Student class not found'}, status=status.HTTP_404_NOT_FOUND)

        if not teacher_can_mark_attendance(request.user.teacher_profile, class_section):
            return Response({'error': 'Only Class Teachers can verify attendance for this class section.'}, status=status.HTTP_403_FORBIDDEN)

        if attendance.verification_status != 'pending':
            return Response({'error': 'Attendance is already verified'}, status=status.HTTP_409_CONFLICT)

        if decision == 'approve':
            attendance.verification_status = 'approved'
            attendance.status = 'present'
        else:
            attendance.verification_status = 'rejected'
            attendance.status = 'absent'

        attendance.marked_by = request.user.teacher_profile
        attendance.verified_by = request.user.teacher_profile
        attendance.verified_at = timezone.now()
        attendance.save()

        # Mark related teacher pending notifications as read.
        student_name = attendance.student.user.name or attendance.student.user.username
        Notification.objects.filter(
            user=request.user,
            title='Attendance Verification Pending',
            is_read=False,
        ).filter(
            Q(message__icontains=student_name) & Q(message__icontains=attendance.date.isoformat())
        ).update(is_read=True)

        return Response(AttendanceSerializer(attendance).data, status=status.HTTP_200_OK)


class TeacherClassAttendanceSummaryView(views.APIView):
    """
    Teacher-only class attendance snapshot for dashboard/attendance screens.

    Query params:
      - class_section_id (required)
      - date (optional, YYYY-MM-DD, defaults to today)
    """

    permission_classes = [IsTeacher]

    def get(self, request):
        class_section_id = request.query_params.get('class_section_id')
        date_raw = request.query_params.get('date')
        if not class_section_id:
            return Response({'error': 'class_section_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            class_section_id = int(class_section_id)
        except Exception:
            return Response({'error': 'Invalid class_section_id'}, status=status.HTTP_400_BAD_REQUEST)

        target_date = date_type.today()
        if date_raw:
            try:
                target_date = date_type.fromisoformat(date_raw)
            except Exception:
                return Response({'error': 'Invalid date format'}, status=status.HTTP_400_BAD_REQUEST)

        qs = ClassSection.objects.select_related('class_ref', 'section_ref', 'class_teacher__user').filter(id=class_section_id)
        if not request.user.is_superuser:
            qs = qs.filter(school=request.user.school)
        class_section = qs.first()
        if not class_section:
            return Response({'error': 'Class section not found'}, status=status.HTTP_404_NOT_FOUND)

        if not teacher_teaches_class_section(request.user.teacher_profile, class_section):
            return Response({'error': 'Not allowed for this class section'}, status=status.HTTP_403_FORBIDDEN)

        students = list(
            StudentProfile.objects.select_related('user')
            .filter(class_section_id=class_section_id)
            .order_by('id')
        )
        student_ids = [s.id for s in students]
        if not student_ids:
            return Response(
                {
                    'class_section_id': class_section.id,
                    'class_display': f'{class_section.class_ref.name} - {class_section.section_ref.name}',
                    'date': target_date.isoformat(),
                    'summary': {
                        'present': 0,
                        'absent': 0,
                        'late': 0,
                        'marked': 0,
                        'total_students': 0,
                        'attendance_percentage': 0.0,
                    },
                    'students': [],
                }
            )

        today_records = Attendance.objects.filter(student_id__in=student_ids, date=target_date)
        today_map = {r.student_id: r for r in today_records}

        # Last 30 day window for low-attendance warning per student.
        window_start = target_date - timedelta(days=29)
        recent_records = Attendance.objects.filter(student_id__in=student_ids, date__gte=window_start, date__lte=target_date)

        recent_by_student = defaultdict(list)
        for r in recent_records:
            recent_by_student[r.student_id].append(r)

        rows = []
        present = 0
        absent = 0
        late = 0
        marked = 0

        for s in students:
            rec = today_map.get(s.id)
            status_value = None
            if rec:
                if rec.verification_status == 'pending':
                    status_value = 'pending'
                elif rec.verification_status == 'approved':
                    status_value = rec.status  # 'present' or 'late' (teacher may mark late)
                    marked += 1
                    if status_value == 'present':
                        present += 1
                    elif status_value == 'late':
                        late += 1
                elif rec.verification_status == 'rejected':
                    status_value = 'absent'
                    marked += 1
                    absent += 1

            recent_list = recent_by_student.get(s.id, [])
            recent_present = sum(
                1 for rr in recent_list if rr.verification_status == 'approved' and rr.status in ('present', 'late')
            )
            recent_marked = sum(1 for rr in recent_list if rr.verification_status in ('approved', 'rejected'))
            recent_pct = (recent_present / recent_marked * 100.0) if recent_marked else 0.0

            rows.append(
                {
                    'id': s.id,
                    'name': s.user.name or s.user.username,
                    'admission_number': s.admission_number,
                    'status': status_value,
                    'status_marked_via': rec.marked_via if rec else None,
                    'recent_attendance_percentage': round(recent_pct, 2),
                    'low_attendance': recent_marked > 0 and recent_pct < 75.0,
                }
            )

        class_attendance_pct = (sum(1 for r in rows if r.get('status') in ('present', 'late')) / marked * 100.0) if marked else 0.0

        return Response(
            {
                'class_section_id': class_section.id,
                'class_display': f'{class_section.class_ref.name} - {class_section.section_ref.name}',
                'date': target_date.isoformat(),
                'summary': {
                    'present': present,
                    'absent': absent,
                    'late': late,
                    'marked': marked,
                    'total_students': len(students),
                    'attendance_percentage': round(class_attendance_pct, 2),
                },
                'students': rows,
            }
        )

class MyAttendanceView(views.APIView):
    """
    Student can see their own attendance history.
    """
    permission_classes = [IsStudent]

    def get(self, request):
        student = get_requested_student(request)
        if not student:
            return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)
            
        records = Attendance.objects.filter(student=student).order_by('-date')
        serializer = AttendanceSerializer(records, many=True)
        return Response(serializer.data)


class MyAttendanceReportPDFView(views.APIView):
    """
    Student-only PDF report:
      - ?period=monthly&month=3&year=2026
      - ?period=yearly&year=2026
    """

    permission_classes = [IsStudent]

    def get(self, request):
        period = (request.query_params.get('period') or 'monthly').lower()
        year = request.query_params.get('year')
        month = request.query_params.get('month')

        try:
            year = int(year) if year is not None else date_type.today().year
        except Exception:
            return Response({'error': 'Invalid year'}, status=status.HTTP_400_BAD_REQUEST)

        if period not in ('monthly', 'yearly'):
            return Response({'error': 'Invalid period'}, status=status.HTTP_400_BAD_REQUEST)

        if period == 'monthly':
            try:
                month = int(month) if month is not None else date_type.today().month
            except Exception:
                return Response({'error': 'Invalid month'}, status=status.HTTP_400_BAD_REQUEST)
            month = max(1, min(12, month))
            month_start = date_type(year, month, 1)
            last_day = calendar.monthrange(year, month)[1]
            month_end = date_type(year, month, last_day)
            start_date, end_date = month_start, month_end
            period_label = f'{month}/{year}'
        else:
            start_date = date_type(year, 1, 1)
            end_date = date_type(year, 12, 31)
            period_label = f'{year}'

        student_profile = get_requested_student(request)
        if not student_profile:
            return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

        # Attendance records in range.
        records_qs = (
            Attendance.objects.filter(student=student_profile)
            .filter(date__gte=start_date, date__lte=end_date)
            .select_related('marked_by')
            .order_by('date')
        )

        attendance_by_date = {r.date: r for r in records_qs}
        present_days = sum(
            1
            for r in records_qs
            if r.verification_status == 'approved' and r.status in ('present', 'late')
        )
        absent_days = sum(1 for r in records_qs if r.verification_status == 'rejected')
        total_marked_days = present_days + absent_days
        attendance_percentage = (present_days / total_marked_days * 100.0) if total_marked_days else 0.0

        summary = {
            'attendance_percentage': attendance_percentage,
            'present_days': present_days,
            'absent_days': absent_days,
            'total_marked_days': total_marked_days,
        }

        # Timetable for subject-wise attendance.
        # Timetable uses class_section. If student doesn't have class_section, we'll keep subject-wise empty.
        timetable_by_day = defaultdict(list)
        if student_profile.class_section_id:
            class_name = student_profile.class_section.class_ref.name
            section = student_profile.class_section.section_ref.name
            timetable_qs = TimeTableEntry.objects.filter(
                class_name=class_name, 
                section=section
            ).all()
            for t in timetable_qs:
                timetable_by_day[t.day].append(t)

        # Holidays in range (skip subject sessions on holidays).
        holiday_by_date = set()
        holidays_qs = Holiday.objects.filter(start_date__lte=end_date).filter(
            Q(end_date__isnull=True, start_date__gte=start_date) | Q(end_date__isnull=False, end_date__gte=start_date)
        )
        for h in holidays_qs:
            h_start = max(h.start_date, start_date)
            h_end = min(h.end_date or h.start_date, end_date)
            d = h_start
            while d <= h_end:
                holiday_by_date.add(d)
                d = d + timedelta(days=1)

        subject_total = defaultdict(int)
        subject_present = defaultdict(int)

        # Count subject-wise per scheduled timetable entry for each attendance-marked date.
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

        total_days = (end_date - start_date).days
        for i in range(total_days + 1):
            cur = start_date + timedelta(days=i)
            if cur in holiday_by_date:
                continue
            rec = attendance_by_date.get(cur)
            if not rec:
                continue

            day_num = cur.weekday() + 1  # Monday=1, ..., Sunday=7
            timetable_entries = timetable_by_day.get(day_num) or []
            if not timetable_entries:
                continue

            if rec.verification_status == 'pending':
                continue

            for t in timetable_entries:
                subject_total[t.subject] += 1
                if rec.verification_status == 'approved' and rec.status in ('present', 'late'):
                    subject_present[t.subject] += 1

        subject_rows = []
        for subject, total in subject_total.items():
            present_count = subject_present.get(subject, 0)
            percent = (present_count / total * 100.0) if total else 0.0
            subject_rows.append(
                {
                    'subject_name': subject,
                    'present_classes': present_count,
                    'total_classes': total,
                    'percentage': percent,
                }
            )
        subject_rows.sort(key=lambda x: x.get('subject_name', ''))

        # Daily rows for monthly reports (monthly only, keeps yearly PDF smaller).
        daily_rows = []
        if period == 'monthly':
            for r in records_qs:
                status_value = r.status
                if r.verification_status == 'pending':
                    status_value = 'pending'
                elif r.verification_status == 'rejected':
                    status_value = 'absent'
                daily_rows.append(
                    {
                        'date': r.date.isoformat(),
                        'status': status_value,
                        'marked_via': r.marked_via,
                    }
                )

        student_name = student_profile.user.name or student_profile.user.username
        class_label = 'N/A'
        if student_profile.class_section_id:
            cs = student_profile.class_section
            try:
                class_label = f'{cs.class_ref.name}-{cs.section_ref.name}'
            except Exception:
                class_label = str(cs)

        pdf_bytes = build_student_attendance_report_pdf(
            student_name=student_name,
            class_label=class_label,
            period_label=period_label,
            attendance_records=records_qs,
            summary=summary,
            subject_rows=subject_rows,
            daily_rows=daily_rows,
        )

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="attendance_report_{period_label.replace("/", "_")}.pdf"'
        return response


class BiometricDevicePunchView(views.APIView):
    """
    Local Bridge Script se biometric card / fingerprint punch data collect karne ke liye secure API.
    School-wise isolation is enforced by requiring the 'school_id' along with the 'rfid_code'.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.conf import settings
        from attendance.models import BiometricDevice
        
        # Verify Token in headers
        api_key = request.headers.get('X-Device-Token')
        school_id = request.data.get('school_id')  # e.g., "school_01"
        rfid_code = request.data.get('rfid_code')
        punch_time_raw = request.data.get('punch_time')  # Format: "YYYY-MM-DD HH:MM:SS"
        
        if not rfid_code or not school_id:
            return Response({'error': 'rfid_code and school_id are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify Token and School ID dynamically in database
        device = BiometricDevice.objects.filter(
            school__school_id=school_id,
            device_secret_key=api_key,
            is_active=True
        ).select_related('school').first()
        
        if not device:
            return Response({'error': 'Unauthorized: Invalid Device Token or School mismatch'}, status=status.HTTP_401_UNAUTHORIZED)


        # Find Student associated strictly with this rfid_code and school_id
        student = StudentProfile.objects.select_related('class_section', 'user', 'school').filter(
            rfid_code=rfid_code,
            school__school_id=school_id
        ).first()
        
        if not student:
            return Response(
                {'error': f'Student with RFID {rfid_code} not found in school {school_id}'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Parse punch time
        try:
            if punch_time_raw:
                punch_dt = datetime_type.strptime(str(punch_time_raw), "%Y-%m-%d %H:%M:%S")
                if timezone.is_naive(punch_dt):
                    punch_dt = timezone.make_aware(punch_dt, timezone.get_current_timezone())
            else:
                punch_dt = timezone.now()
        except Exception:
            punch_dt = timezone.now()

        target_date = punch_dt.date()

        device.last_seen_at = timezone.now()
        device.last_punch_at = punch_dt
        device.last_test_status = 'online'
        device.last_test_message = 'Punch received by backend API.'
        device.save(update_fields=['last_seen_at', 'last_punch_at', 'last_test_status', 'last_test_message'])

        # Create/Update attendance as pending
        attendance, created = Attendance.objects.select_related('student').get_or_create(
            student=student,
            date=target_date,
            defaults={
                'status': 'present',
                'verification_status': 'pending',
                'marked_via': 'rfid',
                'punch_time': punch_dt,
                'class_section': student.class_section
            },
        )

        if not created and attendance.verification_status != 'pending':
            # If student was marked absent (or rejected), but now scans finger, override to present (pending verification)
            if attendance.status == 'absent' or attendance.verification_status == 'rejected':
                attendance.status = 'present'
                attendance.verification_status = 'pending'
                attendance.marked_via = 'rfid'
                attendance.punch_time = punch_dt
                attendance.marked_by = None
                attendance.verified_by = None
                attendance.verified_at = None
                attendance.save()
            else:
                # If already marked present/approved, return 200 OK instead of 409 Conflict
                return Response({
                    'message': 'Punch received: Attendance is already marked present/approved',
                    'student_name': student.user.name or student.user.username,
                    'school_name': student.school.name,
                    'punch_time': attendance.punch_time.isoformat() if attendance.punch_time else punch_dt.isoformat()
                }, status=status.HTTP_200_OK)
        else:
            # Update punch details for multiple punches on the same day (for pending records)
            attendance.status = 'present'
            attendance.verification_status = 'pending'
            attendance.marked_via = 'rfid'
            attendance.punch_time = punch_dt
            attendance.class_section = student.class_section
            attendance.marked_by = None
            attendance.verified_by = None
            attendance.verified_at = None
            attendance.save()

        # Notify Class Teacher
        if created:
            class_section = student.class_section
            if class_section and class_section.class_teacher:
                teacher_user = class_section.class_teacher.user
                Notification.objects.create(
                    user=teacher_user,
                    target_role=teacher_user.role,
                    title='Attendance Verification Pending',
                    message=f"{student.user.name or student.user.username} punched attendance for {target_date.isoformat()}. Please verify (Approve/Reject).",
                    is_read=False,
                )

        return Response({
            'message': 'Punch processed successfully',
            'student_name': student.user.name or student.user.username,
            'school_name': student.school.name,
            'punch_time': punch_dt.isoformat()
        }, status=status.HTTP_201_CREATED)


class BiometricDeviceHeartbeatView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from attendance.models import BiometricDevice

        api_key = request.headers.get('X-Device-Token')
        school_id = request.data.get('school_id')
        status_value = (request.data.get('status') or 'online').strip().lower()
        message = (request.data.get('message') or '').strip()

        if not school_id:
            return Response({'error': 'school_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        device = BiometricDevice.objects.filter(
            school__school_id=school_id,
            device_secret_key=api_key,
            is_active=True,
        ).select_related('school').first()

        if not device:
            return Response({'error': 'Unauthorized: Invalid Device Token or School mismatch'}, status=status.HTTP_401_UNAUTHORIZED)

        now = timezone.now()
        update_fields = ['last_tested_at', 'last_test_status', 'last_test_message']
        device.last_tested_at = now
        device.last_test_status = 'online' if status_value == 'online' else 'offline'
        device.last_test_message = (message or f'Bridge heartbeat: {device.last_test_status}.')[:255]
        if status_value == 'online':
            device.last_seen_at = now
            update_fields.append('last_seen_at')
        device.save(update_fields=update_fields)

        return Response(
            {
                'message': 'Heartbeat received.',
                'device_id': device.id,
                'status': device.last_test_status,
                'recorded_at': now.isoformat(),
            },
            status=status.HTTP_200_OK,
        )

