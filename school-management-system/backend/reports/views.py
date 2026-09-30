import csv
import calendar
import datetime
from collections import OrderedDict
from django.http import HttpResponse, JsonResponse
from django.conf import settings
from django.db.models import Q, Count, Sum
from rest_framework.views import APIView
from rest_framework.response import Response

from attendance.models import Attendance, TeacherAttendance
from academics.models import Marks, Exam, Result
from students.models import StudentProfile
from teachers.models import TeacherProfile
from classes.models import ClassSection
from core.permissions import IsAdmin


# ---------------------------------------------------------------------------
#  Helpers
# ---------------------------------------------------------------------------

def _school_filter(request):
    """Return the school_id for the current admin user."""
    if request.user.is_superuser or request.user.role == 'superadmin':
        return None          # platform users see everything
    return request.user.school_id


def _paginate(queryset, request, default_page_size=50):
    """Simple offset pagination returning (page_qs, meta_dict)."""
    try:
        page = max(int(request.GET.get('page', 1)), 1)
    except (ValueError, TypeError):
        page = 1
    try:
        page_size = min(int(request.GET.get('page_size', default_page_size)), 200)
    except (ValueError, TypeError):
        page_size = default_page_size

    total = queryset.count()
    start = (page - 1) * page_size
    end = start + page_size
    return queryset[start:end], {
        'page': page,
        'page_size': page_size,
        'total': total,
        'total_pages': max(1, -(-total // page_size)),
    }


# ═══════════════════════════════════════════════════════════════════════════
#  PREVIEW  endpoints  (return JSON for on-screen tables)
# ═══════════════════════════════════════════════════════════════════════════

class StudentListPreviewView(APIView):
    """GET /api/reports/preview/students/  ?search=&class=&page="""
    permission_classes = [IsAdmin]

    def get(self, request):
        school_id = _school_filter(request)
        qs = StudentProfile.objects.select_related(
            'user', 'class_section__class_ref', 'class_section__section_ref'
        ).order_by('class_section__class_ref__name', 'roll_number', 'user__name')

        if school_id:
            qs = qs.filter(user__school_id=school_id)

        # Filters
        class_id = request.GET.get('class')
        if class_id and class_id != 'all':
            qs = qs.filter(class_section_id=class_id)

        search = request.GET.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(user__name__icontains=search) |
                Q(user__username__icontains=search) |
                Q(admission_number__icontains=search) |
                Q(roll_number__icontains=search)
            )

        page_qs, meta = _paginate(qs, request)
        rows = []
        for s in page_qs:
            rows.append({
                'id': s.id,
                'name': s.user.name or s.user.get_full_name() or s.user.username,
                'admission_number': s.admission_number,
                'roll_number': s.roll_number or '',
                'class_name': str(s.class_section) if s.class_section else '',
                'gender': s.gender or '',
                'father_name': s.father_name or '',
                'father_contact': s.father_contact or '',
                'date_of_admission': str(s.date_of_admission) if s.date_of_admission else '',
                'category': s.category or '',
            })
        return Response({'results': rows, 'meta': meta})


class TeacherListPreviewView(APIView):
    """GET /api/reports/preview/teachers/  ?search=&status=&page="""
    permission_classes = [IsAdmin]

    def get(self, request):
        school_id = _school_filter(request)
        qs = TeacherProfile.objects.select_related('user').order_by('user__name')

        if school_id:
            qs = qs.filter(user__school_id=school_id)

        status = request.GET.get('status')
        if status and status != 'all':
            qs = qs.filter(status__iexact=status)

        search = request.GET.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(user__name__icontains=search) |
                Q(user__username__icontains=search) |
                Q(employee_id__icontains=search) |
                Q(subject_specialization__icontains=search)
            )

        page_qs, meta = _paginate(qs, request)
        rows = []
        for t in page_qs:
            rows.append({
                'id': t.id,
                'name': t.user.name or t.user.get_full_name() or t.user.username,
                'employee_id': t.employee_id,
                'subject_specialization': t.subject_specialization or '',
                'phone_number': t.phone_number or '',
                'gender': t.gender or '',
                'qualification': t.qualification or '',
                'experience_years': t.experience_years,
                'joining_date': str(t.joining_date) if t.joining_date else '',
                'role': t.role,
                'status': t.status,
            })
        return Response({'results': rows, 'meta': meta})


class StudentAttendancePreviewView(APIView):
    """
    GET /api/reports/preview/student-attendance/
    ?type=daily|monthly|yearly  &date=  &month=  &year=
    &class=  &status=  &student_id=  &page=

    In DAILY mode: students with no record for the date are treated as absent.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        school_id = _school_filter(request)
        filter_type = request.GET.get('type', 'monthly')
        selected_date = request.GET.get('date')
        month = request.GET.get('month')
        year = request.GET.get('year')
        class_id = request.GET.get('class')
        status = request.GET.get('status')
        student_id = request.GET.get('student_id')

        # ------- DAILY mode: merge real records + absent (no-record) -------
        if filter_type == 'daily' and selected_date:
            try:
                sel_date = datetime.date.fromisoformat(selected_date)
            except (ValueError, TypeError):
                sel_date = datetime.date.today()

            # All students
            stu_qs = StudentProfile.objects.select_related(
                'user', 'class_section__class_ref', 'class_section__section_ref'
            ).order_by('class_section__class_ref__name', 'roll_number', 'user__name')
            if school_id:
                stu_qs = stu_qs.filter(user__school_id=school_id)
            if class_id and class_id != 'all':
                stu_qs = stu_qs.filter(class_section_id=class_id)
            if student_id:
                stu_qs = stu_qs.filter(id=student_id)

            # Existing attendance records for that date
            att_qs = Attendance.objects.filter(date=sel_date)
            if school_id:
                att_qs = att_qs.filter(student__user__school_id=school_id)
            if class_id and class_id != 'all':
                att_qs = att_qs.filter(class_section_id=class_id)
            if student_id:
                att_qs = att_qs.filter(student_id=student_id)

            att_map = {}
            for rec in att_qs.select_related('student__user'):
                att_map[rec.student_id] = rec

            # Build combined rows
            all_rows = []
            total_present, total_absent, total_late = 0, 0, 0

            is_sunday = sel_date.weekday() == 6
            is_future = sel_date > datetime.date.today()

            for s in stu_qs:
                rec = att_map.get(s.id)
                if rec:
                    row_status = rec.status
                    via = rec.marked_via
                    row_id = rec.id
                elif is_sunday or is_future:
                    continue
                else:
                    row_status = 'absent'
                    via = '-'
                    row_id = f'absent-{s.id}'

                if row_status == 'present':
                    total_present += 1
                elif row_status == 'absent':
                    total_absent += 1
                elif row_status == 'late':
                    total_late += 1

                all_rows.append({
                    'id': row_id,
                    'student_name': s.user.name or s.user.get_full_name() or s.user.username,
                    'student_id': s.id,
                    'admission_number': s.admission_number,
                    'class_name': str(s.class_section) if s.class_section else '',
                    'date': str(sel_date),
                    'status': row_status,
                    'marked_via': via,
                })

            # Apply status filter AFTER merging
            if status and status != 'all':
                all_rows = [r for r in all_rows if r['status'].lower() == status.lower()]

            # Simple pagination
            try:
                pg = max(int(request.GET.get('page', 1)), 1)
            except (ValueError, TypeError):
                pg = 1
            try:
                ps = min(int(request.GET.get('page_size', 50)), 200)
            except (ValueError, TypeError):
                ps = 50
            total = len(all_rows)
            start = (pg - 1) * ps
            page_rows = all_rows[start:start + ps]

            return Response({
                'results': page_rows,
                'meta': {
                    'page': pg,
                    'page_size': ps,
                    'total': total,
                    'total_pages': max(1, -(-total // ps)),
                },
                'summary': {
                    'present': total_present,
                    'absent': total_absent,
                    'late': total_late,
                    'total': total_present + total_absent + total_late,
                },
            })

        # ------- MONTHLY / YEARLY mode: existing records only -------
        qs = Attendance.objects.select_related(
            'student__user', 'class_section__class_ref', 'class_section__section_ref'
        ).order_by('-date', 'student__user__name')

        if school_id:
            qs = qs.filter(student__user__school_id=school_id)
        if student_id:
            qs = qs.filter(student_id=student_id)
        if class_id and class_id != 'all':
            qs = qs.filter(class_section_id=class_id)
        if status and status != 'all':
            qs = qs.filter(status__iexact=status)

        if filter_type == 'yearly':
            if year:
                try:
                    qs = qs.filter(date__year=int(year))
                except (ValueError, TypeError):
                    pass
        else:  # monthly (default)
            if year:
                try:
                    qs = qs.filter(date__year=int(year))
                except (ValueError, TypeError):
                    pass
            if month:
                try:
                    qs = qs.filter(date__month=int(month))
                except (ValueError, TypeError):
                    pass

        summary = qs.order_by().values('status').annotate(count=Count('id'))
        summary_dict = {}
        for s in summary:
            st = (s.get('status') or '').lower()
            summary_dict[st] = summary_dict.get(st, 0) + s.get('count', 0)

        page_qs, meta = _paginate(qs, request)
        rows = []
        for r in page_qs:
            rows.append({
                'id': r.id,
                'student_name': r.student.user.name or r.student.user.username,
                'student_id': r.student_id,
                'admission_number': r.student.admission_number,
                'class_name': str(r.class_section) if r.class_section else '',
                'date': str(r.date),
                'status': r.status,
                'marked_via': r.marked_via,
            })
        return Response({
            'results': rows,
            'meta': meta,
            'summary': {
                'present': summary_dict.get('present', 0),
                'absent': summary_dict.get('absent', 0),
                'late': summary_dict.get('late', 0),
                'total': meta['total'],
            },
        })


class TeacherAttendancePreviewView(APIView):
    """
    GET /api/reports/preview/teacher-attendance/
    ?type=daily|monthly|yearly  &date=  &month=  &year=
    &status=  &teacher_id=  &page=

    In DAILY mode: teachers with no record for the date are treated as absent.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        school_id = _school_filter(request)
        filter_type = request.GET.get('type', 'monthly')
        selected_date = request.GET.get('date')
        month = request.GET.get('month')
        year = request.GET.get('year')
        status = request.GET.get('status')
        teacher_id = request.GET.get('teacher_id')

        # ------- DAILY mode: merge real records + absent (no-record) -------
        if filter_type == 'daily' and selected_date:
            try:
                sel_date = datetime.date.fromisoformat(selected_date)
            except (ValueError, TypeError):
                sel_date = datetime.date.today()

            # All active teachers
            tch_qs = TeacherProfile.objects.select_related('user').filter(
                status='Active'
            ).order_by('user__name')
            if school_id:
                tch_qs = tch_qs.filter(user__school_id=school_id)
            if teacher_id:
                tch_qs = tch_qs.filter(id=teacher_id)

            # Existing records for that date
            att_qs = TeacherAttendance.objects.filter(date=sel_date)
            if school_id:
                att_qs = att_qs.filter(teacher__user__school_id=school_id)
            if teacher_id:
                att_qs = att_qs.filter(teacher_id=teacher_id)

            att_map = {}
            for rec in att_qs.select_related('teacher__user'):
                att_map[rec.teacher_id] = rec

            # Build combined rows
            all_rows = []
            total_present, total_absent, total_late = 0, 0, 0

            # Sunday check
            is_sunday = sel_date.weekday() == 6
            is_future = sel_date > datetime.date.today()

            for t in tch_qs:
                rec = att_map.get(t.id)
                if rec:
                    row_status = rec.status
                    via = rec.marked_via
                    row_id = rec.id
                elif is_sunday or is_future:
                    continue  # skip Sundays and future dates
                else:
                    row_status = 'absent'
                    via = '-'
                    row_id = f'absent-{t.id}'

                if row_status == 'present':
                    total_present += 1
                elif row_status == 'absent':
                    total_absent += 1
                elif row_status == 'late':
                    total_late += 1

                all_rows.append({
                    'id': row_id,
                    'teacher_name': t.user.name or t.user.get_full_name() or t.user.username,
                    'teacher_id': t.id,
                    'employee_id': t.employee_id,
                    'date': str(sel_date),
                    'status': row_status,
                    'marked_via': via,
                })

            # Apply status filter AFTER merging
            if status and status != 'all':
                all_rows = [r for r in all_rows if r['status'].lower() == status.lower()]

            # Simple pagination
            try:
                pg = max(int(request.GET.get('page', 1)), 1)
            except (ValueError, TypeError):
                pg = 1
            try:
                ps = min(int(request.GET.get('page_size', 50)), 200)
            except (ValueError, TypeError):
                ps = 50
            total = len(all_rows)
            start = (pg - 1) * ps
            page_rows = all_rows[start:start + ps]

            return Response({
                'results': page_rows,
                'meta': {
                    'page': pg,
                    'page_size': ps,
                    'total': total,
                    'total_pages': max(1, -(-total // ps)),
                },
                'summary': {
                    'present': total_present,
                    'absent': total_absent,
                    'late': total_late,
                    'total': total_present + total_absent + total_late,
                },
            })

        # ------- MONTHLY / YEARLY mode: existing records only -------
        qs = TeacherAttendance.objects.select_related(
            'teacher__user'
        ).order_by('-date', 'teacher__user__name')

        if school_id:
            qs = qs.filter(teacher__user__school_id=school_id)
        if teacher_id:
            qs = qs.filter(teacher_id=teacher_id)
        if status and status != 'all':
            qs = qs.filter(status__iexact=status)

        if filter_type == 'yearly':
            if year:
                try:
                    qs = qs.filter(date__year=int(year))
                except (ValueError, TypeError):
                    pass
        else:  # monthly (default)
            if year:
                try:
                    qs = qs.filter(date__year=int(year))
                except (ValueError, TypeError):
                    pass
            if month:
                try:
                    qs = qs.filter(date__month=int(month))
                except (ValueError, TypeError):
                    pass

        summary = qs.order_by().values('status').annotate(count=Count('id'))
        summary_dict = {}
        for s in summary:
            st = (s.get('status') or '').lower()
            summary_dict[st] = summary_dict.get(st, 0) + s.get('count', 0)

        page_qs, meta = _paginate(qs, request)
        rows = []
        for r in page_qs:
            rows.append({
                'id': r.id,
                'teacher_name': r.teacher.user.name or r.teacher.user.username,
                'teacher_id': r.teacher_id,
                'employee_id': r.teacher.employee_id,
                'date': str(r.date),
                'status': r.status,
                'marked_via': r.marked_via,
            })
        return Response({
            'results': rows,
            'meta': meta,
            'summary': {
                'present': summary_dict.get('present', 0),
                'absent': summary_dict.get('absent', 0),
                'late': summary_dict.get('late', 0),
                'total': meta['total'],
            },
        })


class MarksPreviewView(APIView):
    """
    GET /api/reports/preview/marks/
    ?class=  &exam_type=  &student_id=  &search=  &page=
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        school_id = _school_filter(request)
        qs = Marks.objects.select_related(
            'student__user', 'subject', 'class_section__class_ref', 'class_section__section_ref'
        ).order_by('class_section__class_ref__name', 'student__user__name', 'subject__name')

        if school_id:
            qs = qs.filter(student__user__school_id=school_id)

        class_id = request.GET.get('class')
        exam_type = request.GET.get('exam_type')
        student_id = request.GET.get('student_id')
        search = request.GET.get('search', '').strip()

        if class_id and class_id != 'all':
            qs = qs.filter(class_section_id=class_id)
        if exam_type and exam_type != 'all':
            qs = qs.filter(exam_type=exam_type)
        if student_id:
            qs = qs.filter(student_id=student_id)
        if search:
            qs = qs.filter(
                Q(student__user__name__icontains=search) |
                Q(student__user__username__icontains=search) |
                Q(subject__name__icontains=search)
            )

        page_qs, meta = _paginate(qs, request)
        rows = []
        for m in page_qs:
            rows.append({
                'id': m.id,
                'student_name': m.student.user.name or m.student.user.username,
                'student_id': m.student_id,
                'roll_number': m.student.roll_number or '',
                'class_name': str(m.class_section) if m.class_section else '',
                'subject': m.subject.name if m.subject else '',
                'exam_type': m.exam_type,
                'marks': m.marks,
                'max_marks': m.max_marks,
            })
        return Response({'results': rows, 'meta': meta})


# ═══════════════════════════════════════════════════════════════════════════
#  DIARY / REGISTER FORMAT  endpoints  (calendar grid)
# ═══════════════════════════════════════════════════════════════════════════

MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


class StudentAttendanceDiaryView(APIView):
    """
    GET /api/reports/preview/student-attendance-diary/
    ?type=monthly|yearly  &month=  &year=  &class=

    Monthly: Returns a grid with rows=students, columns=days (1..28/30/31)
    Yearly:  Returns a grid with rows=students, columns=months (Jan..Dec)
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        school_id = _school_filter(request)
        filter_type = request.GET.get('type', 'monthly')
        month = request.GET.get('month')
        year = request.GET.get('year')
        class_id = request.GET.get('class')

        try:
            yr = int(year) if year else datetime.date.today().year
        except (ValueError, TypeError):
            yr = datetime.date.today().year

        # Get students
        stu_qs = StudentProfile.objects.select_related(
            'user', 'class_section__class_ref', 'class_section__section_ref'
        ).order_by('class_section__class_ref__name', 'roll_number', 'user__name')
        if school_id:
            stu_qs = stu_qs.filter(user__school_id=school_id)
        if class_id and class_id != 'all':
            stu_qs = stu_qs.filter(class_section_id=class_id)

        students = list(stu_qs[:500])
        if not students:
            return Response({'type': filter_type, 'columns': [], 'rows': [], 'summary': {}})

        student_ids = [s.id for s in students]

        # Get attendance records
        att_qs = Attendance.objects.filter(student_id__in=student_ids, date__year=yr)
        if filter_type == 'monthly':
            try:
                mn = int(month) if month else datetime.date.today().month
            except (ValueError, TypeError):
                mn = datetime.date.today().month
            att_qs = att_qs.filter(date__month=mn)
            num_days = calendar.monthrange(yr, mn)[1]
            columns = [str(d) for d in range(1, num_days + 1)]
        else:  # yearly
            mn = None
            columns = list(MONTH_ABBR)

        # Build lookup: (student_id, date) -> status
        att_map = {}
        for rec in att_qs.values('student_id', 'date', 'status'):
            att_map[(rec['student_id'], rec['date'])] = rec['status']

        rows = []
        total_p, total_a, total_l = 0, 0, 0
        for s in students:
            name = s.user.name or s.user.get_full_name() or s.user.username
            row = {
                'id': s.id,
                'name': name,
                'roll_number': s.roll_number or '',
                'admission_number': s.admission_number,
                'class_name': str(s.class_section) if s.class_section else '',
                'cells': [],
                'present': 0,
                'absent': 0,
                'late': 0,
            }
            if filter_type == 'monthly':
                for d in range(1, num_days + 1):
                    try:
                        dt = datetime.date(yr, mn, d)
                    except ValueError:
                        row['cells'].append('-')
                        continue
                    if dt.weekday() == 6:  # Sunday
                        row['cells'].append('H')
                        continue
                    status = att_map.get((s.id, dt))
                    if status:
                        cell = status[0].upper()  # P, A, L
                        row['cells'].append(cell)
                        if status == 'present':
                            row['present'] += 1
                        elif status == 'absent':
                            row['absent'] += 1
                        elif status == 'late':
                            row['late'] += 1
                    elif dt <= datetime.date.today():
                        row['cells'].append('A')  # No record = Absent
                        row['absent'] += 1
                    else:
                        row['cells'].append('')  # Future
            else:  # yearly
                for m_idx in range(1, 13):
                    days_in_month = calendar.monthrange(yr, m_idx)[1]
                    mp, ma, ml = 0, 0, 0
                    for d in range(1, days_in_month + 1):
                        try:
                            dt = datetime.date(yr, m_idx, d)
                        except ValueError:
                            continue
                        if dt.weekday() == 6:  # Sunday
                            continue
                        status = att_map.get((s.id, dt))
                        if status == 'present':
                            mp += 1
                        elif status == 'absent':
                            ma += 1
                        elif status == 'late':
                            ml += 1
                        elif dt <= datetime.date.today():
                            ma += 1  # No record = Absent
                    row['cells'].append({'P': mp, 'A': ma, 'L': ml, 'total': mp + ma + ml})
                    row['present'] += mp
                    row['absent'] += ma
                    row['late'] += ml

            total_p += row['present']
            total_a += row['absent']
            total_l += row['late']
            rows.append(row)

        return Response({
            'type': filter_type,
            'year': yr,
            'month': mn if filter_type == 'monthly' else None,
            'columns': columns,
            'rows': rows,
            'summary': {
                'total_students': len(students),
                'present': total_p,
                'absent': total_a,
                'late': total_l,
                'total_records': total_p + total_a + total_l,
            },
        })


class TeacherAttendanceDiaryView(APIView):
    """
    GET /api/reports/preview/teacher-attendance-diary/
    ?type=monthly|yearly  &month=  &year=
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        school_id = _school_filter(request)
        filter_type = request.GET.get('type', 'monthly')
        month = request.GET.get('month')
        year = request.GET.get('year')

        try:
            yr = int(year) if year else datetime.date.today().year
        except (ValueError, TypeError):
            yr = datetime.date.today().year

        # Get teachers
        tch_qs = TeacherProfile.objects.select_related('user').filter(
            status='Active'
        ).order_by('user__name')
        if school_id:
            tch_qs = tch_qs.filter(user__school_id=school_id)

        teachers = list(tch_qs[:500])
        if not teachers:
            return Response({'type': filter_type, 'columns': [], 'rows': [], 'summary': {}})

        teacher_ids = [t.id for t in teachers]

        att_qs = TeacherAttendance.objects.filter(teacher_id__in=teacher_ids, date__year=yr)
        if filter_type == 'monthly':
            try:
                mn = int(month) if month else datetime.date.today().month
            except (ValueError, TypeError):
                mn = datetime.date.today().month
            att_qs = att_qs.filter(date__month=mn)
            num_days = calendar.monthrange(yr, mn)[1]
            columns = [str(d) for d in range(1, num_days + 1)]
        else:  # yearly
            mn = None
            columns = list(MONTH_ABBR)

        att_map = {}
        for rec in att_qs.values('teacher_id', 'date', 'status'):
            att_map[(rec['teacher_id'], rec['date'])] = rec['status']

        rows = []
        total_p, total_a, total_l = 0, 0, 0
        for t in teachers:
            name = t.user.name or t.user.get_full_name() or t.user.username
            row = {
                'id': t.id,
                'name': name,
                'employee_id': t.employee_id,
                'cells': [],
                'present': 0,
                'absent': 0,
                'late': 0,
            }
            if filter_type == 'monthly':
                for d in range(1, num_days + 1):
                    try:
                        dt = datetime.date(yr, mn, d)
                    except ValueError:
                        row['cells'].append('-')
                        continue
                    if dt.weekday() == 6:  # Sunday
                        row['cells'].append('H')
                        continue
                    status = att_map.get((t.id, dt))
                    if status:
                        cell = status[0].upper()
                        row['cells'].append(cell)
                        if status == 'present':
                            row['present'] += 1
                        elif status == 'absent':
                            row['absent'] += 1
                        elif status == 'late':
                            row['late'] += 1
                    elif dt <= datetime.date.today():
                        row['cells'].append('A')  # No record = Absent
                        row['absent'] += 1
                    else:
                        row['cells'].append('')
            else:  # yearly
                for m_idx in range(1, 13):
                    days_in_month = calendar.monthrange(yr, m_idx)[1]
                    mp, ma, ml = 0, 0, 0
                    for d in range(1, days_in_month + 1):
                        try:
                            dt = datetime.date(yr, m_idx, d)
                        except ValueError:
                            continue
                        if dt.weekday() == 6:  # Sunday
                            continue
                        status = att_map.get((t.id, dt))
                        if status == 'present':
                            mp += 1
                        elif status == 'absent':
                            ma += 1
                        elif status == 'late':
                            ml += 1
                        elif dt <= datetime.date.today():
                            ma += 1  # No record = Absent
                    row['cells'].append({'P': mp, 'A': ma, 'L': ml, 'total': mp + ma + ml})
                    row['present'] += mp
                    row['absent'] += ma
                    row['late'] += ml

            total_p += row['present']
            total_a += row['absent']
            total_l += row['late']
            rows.append(row)

        return Response({
            'type': filter_type,
            'year': yr,
            'month': mn if filter_type == 'monthly' else None,
            'columns': columns,
            'rows': rows,
            'summary': {
                'total_teachers': len(teachers),
                'present': total_p,
                'absent': total_a,
                'late': total_l,
                'total_records': total_p + total_a + total_l,
            },
        })


# ═══════════════════════════════════════════════════════════════════════════
#  STUDENT / TEACHER LIST  for dropdowns
# ═══════════════════════════════════════════════════════════════════════════

class StudentListDropdownView(APIView):
    """Lightweight list for select dropdowns: GET /api/reports/students-dropdown/?class="""
    permission_classes = [IsAdmin]

    def get(self, request):
        school_id = _school_filter(request)
        qs = StudentProfile.objects.select_related('user').order_by('user__name')
        if school_id:
            qs = qs.filter(user__school_id=school_id)
        class_id = request.GET.get('class')
        if class_id and class_id != 'all':
            qs = qs.filter(class_section_id=class_id)
        items = [{'id': s.id, 'name': s.user.name or s.user.username, 'admission_number': s.admission_number}
                 for s in qs[:500]]
        return Response(items)


class TeacherListDropdownView(APIView):
    """Lightweight list for select dropdowns: GET /api/reports/teachers-dropdown/"""
    permission_classes = [IsAdmin]

    def get(self, request):
        school_id = _school_filter(request)
        qs = TeacherProfile.objects.select_related('user').filter(status='Active').order_by('user__name')
        if school_id:
            qs = qs.filter(user__school_id=school_id)
        items = [{'id': t.id, 'name': t.user.name or t.user.username, 'employee_id': t.employee_id}
                 for t in qs[:500]]
        return Response(items)


# ═══════════════════════════════════════════════════════════════════════════
#  DOWNLOAD  endpoint  (CSV)
# ═══════════════════════════════════════════════════════════════════════════

class AdminReportDownloadView(APIView):
    permission_classes = [IsAdmin]
    throttle_scope = 'report'

    def get(self, request):
        report_cat = request.GET.get('report_cat', 'attendance')
        filter_type = request.GET.get('type', 'daily')
        selected_date = request.GET.get('date')
        month = request.GET.get('month')
        year = request.GET.get('year')
        class_id = request.GET.get('class')
        status_filter = request.GET.get('status')
        student_id = request.GET.get('student_id')
        teacher_id = request.GET.get('teacher_id')
        exam_type = request.GET.get('exam_type')
        search = request.GET.get('search', '').strip()
        school_id = _school_filter(request)

        max_rows = getattr(settings, 'API_MAX_EXPORT_ROWS', 10000)

        # -----------------------------------------------------------
        #  STUDENT LIST
        # -----------------------------------------------------------
        if report_cat == 'students':
            qs = StudentProfile.objects.select_related(
                'user', 'class_section__class_ref', 'class_section__section_ref'
            ).order_by('class_section__class_ref__name', 'roll_number')
            if school_id:
                qs = qs.filter(user__school_id=school_id)
            if class_id and class_id != 'all':
                qs = qs.filter(class_section_id=class_id)
            if search:
                qs = qs.filter(
                    Q(user__name__icontains=search) | Q(admission_number__icontains=search)
                )

            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="student_list.csv"'
            writer = csv.writer(response)
            writer.writerow(['Name', 'Admission No', 'Roll No', 'Class', 'Gender',
                             'Father Name', 'Father Contact', 'Admission Date', 'Category'])
            for s in qs[:max_rows]:
                writer.writerow([
                    s.user.name or s.user.username,
                    s.admission_number,
                    s.roll_number or '',
                    str(s.class_section) if s.class_section else '',
                    s.gender or '',
                    s.father_name or '',
                    s.father_contact or '',
                    s.date_of_admission or '',
                    s.category or '',
                ])
            return response

        # -----------------------------------------------------------
        #  TEACHER LIST
        # -----------------------------------------------------------
        elif report_cat == 'teachers':
            qs = TeacherProfile.objects.select_related('user').order_by('user__name')
            if school_id:
                qs = qs.filter(user__school_id=school_id)
            if status_filter and status_filter != 'all':
                qs = qs.filter(status__iexact=status_filter)
            if search:
                qs = qs.filter(
                    Q(user__name__icontains=search) | Q(employee_id__icontains=search)
                )

            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="teacher_list.csv"'
            writer = csv.writer(response)
            writer.writerow(['Name', 'Employee ID', 'Specialization', 'Phone',
                             'Gender', 'Qualification', 'Experience (Yrs)',
                             'Joining Date', 'Role', 'Status'])
            for t in qs[:max_rows]:
                writer.writerow([
                    t.user.name or t.user.username,
                    t.employee_id,
                    t.subject_specialization or '',
                    t.phone_number or '',
                    t.gender or '',
                    t.qualification or '',
                    t.experience_years or '',
                    t.joining_date or '',
                    t.role,
                    t.status,
                ])
            return response

        # -----------------------------------------------------------
        #  STUDENT ATTENDANCE
        # -----------------------------------------------------------
        elif report_cat == 'attendance':
            time_str = self._time_str(filter_type, selected_date, month, year)
            filename = f"student_attendance_{time_str}.csv"
            if student_id:
                try:
                    sp = StudentProfile.objects.get(id=student_id)
                    sname = (sp.user.name or sp.user.username).replace(' ', '_')
                    filename = f"student_{sname}_attendance_{time_str}.csv"
                except StudentProfile.DoesNotExist:
                    pass

            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            writer = csv.writer(response)
            writer.writerow(['Student Name', 'Admission No', 'Class', 'Date', 'Status', 'Marked Via'])

            if filter_type == 'daily':
                try:
                    sel_date = datetime.date.fromisoformat(selected_date) if selected_date else datetime.date.today()
                except (ValueError, TypeError):
                    sel_date = datetime.date.today()

                stu_qs = StudentProfile.objects.select_related(
                    'user', 'class_section__class_ref', 'class_section__section_ref'
                ).order_by('class_section__class_ref__name', 'roll_number', 'user__name')
                if school_id:
                    stu_qs = stu_qs.filter(user__school_id=school_id)
                if class_id and class_id != 'all':
                    stu_qs = stu_qs.filter(class_section_id=class_id)
                if student_id:
                    stu_qs = stu_qs.filter(id=student_id)

                att_qs = Attendance.objects.filter(date=sel_date)
                if school_id:
                    att_qs = att_qs.filter(student__user__school_id=school_id)
                if class_id and class_id != 'all':
                    att_qs = att_qs.filter(class_section_id=class_id)
                if student_id:
                    att_qs = att_qs.filter(student_id=student_id)

                att_map = {rec.student_id: rec for rec in att_qs.select_related('student__user')}
                is_sunday = sel_date.weekday() == 6
                is_future = sel_date > datetime.date.today()

                count = 0
                for s in stu_qs:
                    rec = att_map.get(s.id)
                    if rec:
                        row_status = rec.status
                        via = rec.marked_via
                    elif is_sunday or is_future:
                        continue
                    else:
                        row_status = 'absent'
                        via = '-'

                    if status_filter and status_filter != 'all':
                        if row_status.lower() != status_filter.lower():
                            continue

                    writer.writerow([
                        s.user.name or s.user.get_full_name() or s.user.username,
                        s.admission_number,
                        str(s.class_section) if s.class_section else '',
                        str(sel_date),
                        row_status.capitalize(),
                        via,
                    ])
                    count += 1
                    if count >= max_rows:
                        break
                return response
            else:
                qs = Attendance.objects.select_related(
                    'student__user', 'class_section__class_ref', 'class_section__section_ref'
                ).order_by('-date', 'student__user__name')
                if school_id:
                    qs = qs.filter(student__user__school_id=school_id)
                if student_id:
                    qs = qs.filter(student_id=student_id)
                if class_id and class_id != 'all':
                    qs = qs.filter(class_section_id=class_id)
                if status_filter and status_filter != 'all':
                    qs = qs.filter(status__iexact=status_filter)
                if filter_type == 'yearly':
                    if year:
                        try:
                            qs = qs.filter(date__year=int(year))
                        except (ValueError, TypeError):
                            pass
                else:  # monthly (default)
                    if year:
                        try:
                            qs = qs.filter(date__year=int(year))
                        except (ValueError, TypeError):
                            pass
                    if month:
                        try:
                            qs = qs.filter(date__month=int(month))
                        except (ValueError, TypeError):
                            pass

                for r in qs[:max_rows]:
                    writer.writerow([
                        r.student.user.name or r.student.user.username,
                        r.student.admission_number,
                        str(r.class_section) if r.class_section else '',
                        r.date,
                        (r.status or '').capitalize(),
                        r.marked_via,
                    ])
                return response

        # -----------------------------------------------------------
        #  TEACHER ATTENDANCE
        # -----------------------------------------------------------
        elif report_cat == 'teacher_attendance':
            time_str = self._time_str(filter_type, selected_date, month, year)
            filename = f"teacher_attendance_{time_str}.csv"
            if teacher_id:
                try:
                    tp = TeacherProfile.objects.get(id=teacher_id)
                    tname = (tp.user.name or tp.user.username).replace(' ', '_')
                    filename = f"teacher_{tname}_attendance_{time_str}.csv"
                except TeacherProfile.DoesNotExist:
                    pass

            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            writer = csv.writer(response)
            writer.writerow(['Teacher Name', 'Employee ID', 'Date', 'Status', 'Marked Via'])

            if filter_type == 'daily':
                try:
                    sel_date = datetime.date.fromisoformat(selected_date) if selected_date else datetime.date.today()
                except (ValueError, TypeError):
                    sel_date = datetime.date.today()

                tch_qs = TeacherProfile.objects.select_related('user').filter(status='Active').order_by('user__name')
                if school_id:
                    tch_qs = tch_qs.filter(user__school_id=school_id)
                if teacher_id:
                    tch_qs = tch_qs.filter(id=teacher_id)

                att_qs = TeacherAttendance.objects.filter(date=sel_date)
                if school_id:
                    att_qs = att_qs.filter(teacher__user__school_id=school_id)
                if teacher_id:
                    att_qs = att_qs.filter(teacher_id=teacher_id)

                att_map = {rec.teacher_id: rec for rec in att_qs.select_related('teacher__user')}
                is_sunday = sel_date.weekday() == 6
                is_future = sel_date > datetime.date.today()

                count = 0
                for t in tch_qs:
                    rec = att_map.get(t.id)
                    if rec:
                        row_status = rec.status
                        via = rec.marked_via
                    elif is_sunday or is_future:
                        continue
                    else:
                        row_status = 'absent'
                        via = '-'

                    if status_filter and status_filter != 'all':
                        if row_status.lower() != status_filter.lower():
                            continue

                    writer.writerow([
                        t.user.name or t.user.get_full_name() or t.user.username,
                        t.employee_id,
                        str(sel_date),
                        row_status.capitalize(),
                        via,
                    ])
                    count += 1
                    if count >= max_rows:
                        break
                return response
            else:
                qs = TeacherAttendance.objects.select_related(
                    'teacher__user'
                ).order_by('-date', 'teacher__user__name')
                if school_id:
                    qs = qs.filter(teacher__user__school_id=school_id)
                if teacher_id:
                    qs = qs.filter(teacher_id=teacher_id)
                if status_filter and status_filter != 'all':
                    qs = qs.filter(status__iexact=status_filter)
                if filter_type == 'yearly':
                    if year:
                        try:
                            qs = qs.filter(date__year=int(year))
                        except (ValueError, TypeError):
                            pass
                else:  # monthly (default)
                    if year:
                        try:
                            qs = qs.filter(date__year=int(year))
                        except (ValueError, TypeError):
                            pass
                    if month:
                        try:
                            qs = qs.filter(date__month=int(month))
                        except (ValueError, TypeError):
                            pass

                for r in qs[:max_rows]:
                    writer.writerow([
                        r.teacher.user.name or r.teacher.user.username,
                        r.teacher.employee_id,
                        r.date,
                        (r.status or '').capitalize(),
                        r.marked_via,
                    ])
                return response

        # -----------------------------------------------------------
        #  MARKS
        # -----------------------------------------------------------
        elif report_cat == 'marks':
            qs = Marks.objects.select_related(
                'student__user', 'subject', 'class_section__class_ref', 'class_section__section_ref'
            ).order_by('class_section__class_ref__name', 'student__user__name', 'subject__name')
            if school_id:
                qs = qs.filter(student__user__school_id=school_id)
            if class_id and class_id != 'all':
                qs = qs.filter(class_section_id=class_id)
            if exam_type and exam_type != 'all':
                qs = qs.filter(exam_type=exam_type)
            if student_id:
                qs = qs.filter(student_id=student_id)
            if search:
                qs = qs.filter(
                    Q(student__user__name__icontains=search) | Q(subject__name__icontains=search)
                )

            filename = "marks_report.csv"
            if student_id:
                try:
                    sp = StudentProfile.objects.get(id=student_id)
                    sname = (sp.user.name or sp.user.username).replace(' ', '_')
                    filename = f"student_{sname}_marks.csv"
                except StudentProfile.DoesNotExist:
                    pass
            elif class_id and class_id != 'all':
                try:
                    cs = ClassSection.objects.select_related('class_ref', 'section_ref').get(id=class_id)
                    filename = f"class_{cs.class_ref.name}_{cs.section_ref.name}_marks.csv"
                except ClassSection.DoesNotExist:
                    pass

            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            writer = csv.writer(response)
            writer.writerow(['Student Name', 'Roll No', 'Class', 'Subject', 'Exam Type', 'Marks', 'Max Marks'])
            for m in qs[:max_rows]:
                writer.writerow([
                    m.student.user.name or m.student.user.username,
                    m.student.roll_number or '',
                    str(m.class_section) if m.class_section else '',
                    m.subject.name if m.subject else '',
                    m.exam_type,
                    m.marks,
                    m.max_marks,
                ])
            return response

        return HttpResponse("Invalid report category", status=400)

    @staticmethod
    def _time_str(filter_type, selected_date, month, year):
        if filter_type == 'daily' and selected_date:
            return str(selected_date)
        elif filter_type == 'monthly' and month and year:
            return f"{month}_{year}"
        elif filter_type == 'yearly' and year:
            return str(year)
        return 'all'
