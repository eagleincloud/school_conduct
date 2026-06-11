"""
Teacher / Staff Attendance views — managed by school admin.
Teachers can only view their own attendance via TeacherMyAttendanceView.
"""
from collections import defaultdict
from datetime import date as date_type, timedelta, datetime as datetime_type

from django.db import transaction
from django.utils import timezone
from rest_framework import status, views, permissions
from rest_framework.response import Response

from .models import TeacherAttendance, BiometricDevice
from .serializers import TeacherAttendanceSerializer
from core.permissions import IsAdmin, IsTeacher
from teachers.models import TeacherProfile


def get_user_school(user):
    if not user or user.is_anonymous:
        return None
    try:
        school = user.school
        if school:
            return school
    except Exception:
        pass
    from tenants.models import School
    return School.objects.first()


# ─────────────────────────────────────────────────────────────────────
# Admin: get teacher attendance sheet for a date
# ─────────────────────────────────────────────────────────────────────
class AdminTeacherAttendanceSheetView(views.APIView):
    """
    Returns all active teachers for the school with their attendance
    status for the given date.  Mirrors TeacherAttendanceSheetView
    (student version) but for teachers, controlled by admin.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        date_raw = request.query_params.get('date')
        target_date = timezone.localdate()
        if date_raw:
            try:
                target_date = date_type.fromisoformat(date_raw)
            except Exception:
                return Response({'error': 'Invalid date format'}, status=status.HTTP_400_BAD_REQUEST)

        school = get_user_school(request.user)
        teachers = list(
            TeacherProfile.objects.select_related('user', 'school')
            .filter(school=school, status='Active')
            .order_by('id')
        )
        teacher_ids = [t.id for t in teachers]

        records = TeacherAttendance.objects.filter(teacher_id__in=teacher_ids, date=target_date)
        rec_by_teacher = {r.teacher_id: r for r in records}

        rows = []
        present = 0
        absent = 0
        late = 0
        marked = 0

        for t in teachers:
            rec = rec_by_teacher.get(t.id)
            st = rec.status if rec else None
            if st in ('present', 'absent', 'late'):
                marked += 1
                if st == 'present':
                    present += 1
                elif st == 'absent':
                    absent += 1
                elif st == 'late':
                    late += 1
            rows.append({
                'teacher_id': t.id,
                'name': t.user.name or t.user.username,
                'employee_id': f"{t.school.school_id if t.school else 'NS'}-{t.employee_id}",
                'status': st,
                'punch_in_time': rec.punch_in_time.isoformat() if rec and rec.punch_in_time else None,
                'punch_out_time': rec.punch_out_time.isoformat() if rec and rec.punch_out_time else None,
                'marked_via': rec.marked_via if rec else None,
            })

        is_editable = target_date == timezone.localdate()

        return Response({
            'date': target_date.isoformat(),
            'is_editable': is_editable,
            'summary': {
                'present': present,
                'absent': absent,
                'late': late,
                'marked': marked,
                'total_teachers': len(teachers),
            },
            'teachers': rows,
        })


# ─────────────────────────────────────────────────────────────────────
# Admin: bulk-save teacher attendance for a date
# ─────────────────────────────────────────────────────────────────────
class AdminTeacherAttendanceBulkSaveView(views.APIView):
    """
    Save teacher attendance in bulk for a single date.
    Upsert behavior (update_or_create) prevents duplicates.
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        date_raw = request.data.get('date')
        rows = request.data.get('rows') or []

        if not date_raw or not isinstance(rows, list):
            return Response(
                {'error': 'date and rows[] are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_date = date_type.fromisoformat(str(date_raw))
        except Exception:
            return Response({'error': 'Invalid date'}, status=status.HTTP_400_BAD_REQUEST)

        if target_date != timezone.localdate():
            return Response(
                {'error': 'Past attendance records are view-only. You can edit attendance only for today.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        school = get_user_school(request.user)
        valid_teacher_ids = set(
            TeacherProfile.objects.filter(school=school, status='Active')
            .values_list('id', flat=True)
        )

        save_count = 0
        with transaction.atomic():
            for row in rows:
                try:
                    tid = int(row.get('teacher_id'))
                except Exception:
                    continue
                status_value = (row.get('status') or '').lower()
                if tid not in valid_teacher_ids:
                    continue
                if status_value not in ('present', 'absent', 'late'):
                    continue

                TeacherAttendance.objects.update_or_create(
                    teacher_id=tid,
                    date=target_date,
                    defaults={
                        'status': status_value,
                        'marked_by': request.user,
                        'marked_via': 'manual',
                    },
                )
                save_count += 1

        if save_count == 0:
            return Response(
                {'error': 'No attendance was saved. Please mark at least one teacher.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({'message': 'Attendance saved', 'saved': save_count}, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────
# Admin: mark a single teacher present/absent/late
# ─────────────────────────────────────────────────────────────────────
class AdminTeacherAttendanceMarkView(views.APIView):
    """
    Mark a single teacher's attendance for a given date.
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        teacher_id = request.data.get('teacher_id')
        date_raw = request.data.get('date')
        status_value = (request.data.get('status') or '').lower()

        if not teacher_id or not date_raw or status_value not in ('present', 'absent', 'late'):
            return Response(
                {'error': 'teacher_id, date, and status (present/absent/late) are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_date = date_type.fromisoformat(str(date_raw))
        except Exception:
            return Response({'error': 'Invalid date format'}, status=status.HTTP_400_BAD_REQUEST)

        if target_date != timezone.localdate():
            return Response(
                {'error': 'Attendance can only be edited for today.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        school = get_user_school(request.user)
        teacher = TeacherProfile.objects.select_related('user', 'school').filter(
            id=teacher_id, school=school, status='Active'
        ).first()
        if not teacher:
            return Response({'error': 'Teacher not found'}, status=status.HTTP_404_NOT_FOUND)

        attendance, _ = TeacherAttendance.objects.update_or_create(
            teacher=teacher,
            date=target_date,
            defaults={
                'status': status_value,
                'marked_by': request.user,
                'marked_via': 'manual',
            },
        )

        return Response(TeacherAttendanceSerializer(attendance).data, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────
# Admin: attendance summary (monthly stats)
# ─────────────────────────────────────────────────────────────────────
class AdminTeacherAttendanceSummaryView(views.APIView):
    """
    Teacher attendance summary for a date or month.
    Query params:
      - date  (YYYY-MM-DD, defaults to today)
      - month (1-12, optional — if provided, returns monthly summary)
      - year  (YYYY, optional — defaults to current year)
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        school = get_user_school(request.user)
        date_raw = request.query_params.get('date')
        month_raw = request.query_params.get('month')
        year_raw = request.query_params.get('year')

        target_date = timezone.localdate()
        if date_raw:
            try:
                target_date = date_type.fromisoformat(date_raw)
            except Exception:
                return Response({'error': 'Invalid date'}, status=status.HTTP_400_BAD_REQUEST)

        teachers = list(
            TeacherProfile.objects.select_related('user', 'school')
            .filter(school=school, status='Active')
            .order_by('id')
        )
        teacher_ids = [t.id for t in teachers]
        total_teachers = len(teachers)

        # ── Daily snapshot ──
        day_records = TeacherAttendance.objects.filter(teacher_id__in=teacher_ids, date=target_date)
        day_map = {r.teacher_id: r for r in day_records}
        day_present = sum(1 for r in day_records if r.status in ('present', 'late'))
        day_absent = sum(1 for r in day_records if r.status == 'absent')
        day_late = sum(1 for r in day_records if r.status == 'late')

        result = {
            'date': target_date.isoformat(),
            'total_teachers': total_teachers,
            'today': {
                'present': day_present,
                'absent': day_absent,
                'late': day_late,
                'marked': day_present + day_absent,
                'attendance_pct': round(day_present / total_teachers * 100, 2) if total_teachers else 0,
            },
        }

        # ── Monthly breakdown (optional) ──
        if month_raw or year_raw:
            try:
                year = int(year_raw) if year_raw else target_date.year
                month = int(month_raw) if month_raw else target_date.month
            except Exception:
                return Response({'error': 'Invalid month/year'}, status=status.HTTP_400_BAD_REQUEST)

            import calendar
            _, last_day = calendar.monthrange(year, month)
            month_start = date_type(year, month, 1)
            month_end = date_type(year, month, last_day)

            month_records = TeacherAttendance.objects.filter(
                teacher_id__in=teacher_ids,
                date__gte=month_start,
                date__lte=month_end,
            )

            # Per-teacher monthly stats
            teacher_stats = []
            by_teacher = defaultdict(list)
            for r in month_records:
                by_teacher[r.teacher_id].append(r)

            for t in teachers:
                recs = by_teacher.get(t.id, [])
                t_present = sum(1 for r in recs if r.status in ('present', 'late'))
                t_absent = sum(1 for r in recs if r.status == 'absent')
                t_late = sum(1 for r in recs if r.status == 'late')
                t_total = t_present + t_absent
                teacher_stats.append({
                    'teacher_id': t.id,
                    'name': t.user.name or t.user.username,
                    'employee_id': f"{t.school.school_id if t.school else 'NS'}-{t.employee_id}",
                    'present': t_present,
                    'absent': t_absent,
                    'late': t_late,
                    'total_marked': t_total,
                    'attendance_pct': round(t_present / t_total * 100, 2) if t_total else 0,
                })

            result['monthly'] = {
                'year': year,
                'month': month,
                'teacher_stats': teacher_stats,
            }

        return Response(result)


# ─────────────────────────────────────────────────────────────────────
# Teacher: view own attendance history
# ─────────────────────────────────────────────────────────────────────
class TeacherMyAttendanceView(views.APIView):
    """
    Teacher views their own attendance records.
    Query params:
      - month (1-12, optional, defaults to current month)
      - year  (YYYY, optional, defaults to current year)
    """
    permission_classes = [IsTeacher]

    def get(self, request):
        teacher_profile = getattr(request.user, 'teacher_profile', None)
        if not teacher_profile:
            return Response({'error': 'Teacher profile not found'}, status=status.HTTP_404_NOT_FOUND)

        month_raw = request.query_params.get('month')
        year_raw = request.query_params.get('year')

        today = timezone.localdate()
        try:
            year = int(year_raw) if year_raw else today.year
            month = int(month_raw) if month_raw else today.month
        except Exception:
            return Response({'error': 'Invalid month/year'}, status=status.HTTP_400_BAD_REQUEST)

        import calendar
        _, last_day = calendar.monthrange(year, month)
        month_start = date_type(year, month, 1)
        month_end = date_type(year, month, last_day)

        records = (
            TeacherAttendance.objects
            .filter(teacher=teacher_profile, date__gte=month_start, date__lte=month_end)
            .order_by('date')
        )

        present = sum(1 for r in records if r.status in ('present', 'late'))
        absent = sum(1 for r in records if r.status == 'absent')
        late = sum(1 for r in records if r.status == 'late')
        total_marked = present + absent

        daily = []
        for r in records:
            daily.append({
                'date': r.date.isoformat(),
                'status': r.status,
                'punch_in_time': r.punch_in_time.isoformat() if r.punch_in_time else None,
                'punch_out_time': r.punch_out_time.isoformat() if r.punch_out_time else None,
                'marked_via': r.marked_via,
            })

        # Build calendar grid (all days in month with status)
        calendar_grid = []
        for day_num in range(1, last_day + 1):
            d = date_type(year, month, day_num)
            rec = next((r for r in records if r.date == d), None)
            calendar_grid.append({
                'date': d.isoformat(),
                'day': day_num,
                'weekday': d.strftime('%a'),
                'status': rec.status if rec else None,
            })

        return Response({
            'year': year,
            'month': month,
            'month_name': calendar.month_name[month],
            'summary': {
                'present': present,
                'absent': absent,
                'late': late,
                'total_marked': total_marked,
                'attendance_pct': round(present / total_marked * 100, 2) if total_marked else 0,
            },
            'daily': daily,
            'calendar': calendar_grid,
        })


# ─────────────────────────────────────────────────────────────────────
# Biometric punch-in / punch-out for teachers
# ─────────────────────────────────────────────────────────────────────
class TeacherBiometricPunchView(views.APIView):
    """
    Biometric / RFID punch for teacher attendance.
    First punch of the day = punch-in, second = punch-out.
    Uses the same device authentication as student biometric punch.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        api_key = request.headers.get('X-Device-Token')
        school_id = request.data.get('school_id')
        rfid_code = request.data.get('rfid_code')
        punch_time_raw = request.data.get('punch_time')

        if not rfid_code or not school_id:
            return Response(
                {'error': 'rfid_code and school_id are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify device token
        device = BiometricDevice.objects.filter(
            school__school_id=school_id,
            device_secret_key=api_key,
            is_active=True,
        ).select_related('school').first()

        if not device:
            return Response(
                {'error': 'Unauthorized: Invalid Device Token or School mismatch'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Find teacher by RFID
        teacher = TeacherProfile.objects.select_related('user', 'school').filter(
            rfid_code=rfid_code,
            user__school__school_id=school_id,
        ).first()

        if not teacher:
            return Response(
                {'error': f'Teacher with RFID {rfid_code} not found in school {school_id}'},
                status=status.HTTP_404_NOT_FOUND,
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

        # Update device last_seen
        device.last_seen_at = timezone.now()
        device.last_punch_at = punch_dt
        device.last_test_status = 'online'
        device.last_test_message = 'Teacher punch received by backend API.'
        device.save(update_fields=['last_seen_at', 'last_punch_at', 'last_test_status', 'last_test_message'])

        # Get or create attendance record
        attendance, created = TeacherAttendance.objects.get_or_create(
            teacher=teacher,
            date=target_date,
            defaults={
                'status': 'present',
                'marked_via': 'rfid',
                'punch_in_time': punch_dt,
            },
        )

        if not created:
            # Already has a record — this is punch-out (or update)
            if not attendance.punch_out_time or attendance.punch_out_time < punch_dt:
                attendance.punch_out_time = punch_dt
                attendance.save(update_fields=['punch_out_time'])

            return Response({
                'message': 'Punch-out recorded' if attendance.punch_out_time else 'Punch updated',
                'teacher_name': teacher.user.name or teacher.user.username,
                'school_name': teacher.school.name if teacher.school else '',
                'punch_in_time': attendance.punch_in_time.isoformat() if attendance.punch_in_time else None,
                'punch_out_time': attendance.punch_out_time.isoformat() if attendance.punch_out_time else None,
            }, status=status.HTTP_200_OK)

        return Response({
            'message': 'Punch-in recorded successfully',
            'teacher_name': teacher.user.name or teacher.user.username,
            'school_name': teacher.school.name if teacher.school else '',
            'punch_in_time': punch_dt.isoformat(),
        }, status=status.HTTP_201_CREATED)
