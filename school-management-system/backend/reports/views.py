import csv
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAdminUser
from django.db.models import Q
from attendance.models import Attendance
from academics.models import Result, Exam
from students.models import StudentProfile
from teachers.models import TeacherProfile
from classes.models import ClassSection
import datetime

class AdminReportDownloadView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        report_cat = request.GET.get('report_cat', 'attendance') # attendance, marks, students, teachers
        filter_type = request.GET.get('type', 'daily') # daily, monthly, yearly
        selected_date = request.GET.get('date')
        month = request.GET.get('month')
        year = request.GET.get('year')
        class_id = request.GET.get('class')

        # Base querysets
        if report_cat == 'attendance':
            queryset = Attendance.objects.all().select_related('student__user', 'class_section__class_ref', 'class_section__section_ref')
            date_field = 'date'
            class_field = 'student__class_section'
        elif report_cat == 'marks':
            queryset = Result.objects.all().select_related('student__user', 'exam', 'student__class_section__class_ref', 'student__class_section__section_ref')
            date_field = 'exam__date'
            class_field = 'student__class_section'
        elif report_cat == 'students':
            queryset = StudentProfile.objects.all().select_related('user', 'class_section__class_ref', 'class_section__section_ref')
            date_field = 'date_of_admission'
            class_field = 'class_section'
        elif report_cat == 'teachers':
            queryset = TeacherProfile.objects.all().select_related('user')
            date_field = 'joining_date'
            class_field = None
        else:
            return HttpResponse("Invalid report category", status=400)

        # Apply Class Filter
        if class_id and class_id != 'all' and class_field:
            queryset = queryset.filter(**{class_field: class_id})

        # Apply Time Filters
        if filter_type == 'daily' and selected_date:
            queryset = queryset.filter(**{date_field: selected_date})
        elif filter_type == 'monthly' and month and year:
            queryset = queryset.filter(**{f"{date_field}__month": month, f"{date_field}__year": year})
        elif filter_type == 'yearly' and year:
            queryset = queryset.filter(**{f"{date_field}__year": year})

        # Generate CSV
        response = HttpResponse(content_type='text/csv')
        
        # Filename generation logic
        class_name = "all_classes"
        if class_id and class_id != 'all':
            try:
                cs = ClassSection.objects.get(id=class_id)
                class_name = f"class{cs.class_ref.name.replace(' ', '')}"
            except:
                pass
        
        time_str = ""
        if filter_type == 'daily': time_str = selected_date
        elif filter_type == 'monthly': time_str = f"{month}_{year}"
        elif filter_type == 'yearly': time_str = year
        
        filename = f"{report_cat}_{class_name}_{filter_type}_{time_str}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        
        if report_cat == 'attendance':
            writer.writerow(['Student Name', 'Admission No', 'Class', 'Date', 'Status', 'Marked Via'])
            for record in queryset:
                writer.writerow([
                    record.student.user.get_full_name() or record.student.user.username,
                    record.student.admission_number,
                    str(record.class_section),
                    record.date,
                    record.status,
                    record.marked_via
                ])
        elif report_cat == 'marks':
            writer.writerow(['Student Name', 'Roll No', 'Class', 'Exam', 'Subject', 'Marks Obtained', 'Max Marks'])
            for record in queryset:
                writer.writerow([
                    record.student.user.get_full_name() or record.student.user.username,
                    record.student.roll_number,
                    str(record.student.class_section),
                    record.exam.name,
                    record.subject,
                    record.marks,
                    record.max_marks
                ])
        elif report_cat == 'students':
            writer.writerow(['Name', 'Admission No', 'Roll No', 'Class', 'Guardian Name', 'Contact', 'Admission Date'])
            for record in queryset:
                writer.writerow([
                    record.user.get_full_name() or record.user.username,
                    record.admission_number,
                    record.roll_number,
                    str(record.class_section),
                    record.parent_guardian_name,
                    record.parent_contact_number,
                    record.date_of_admission
                ])
        elif report_cat == 'teachers':
            writer.writerow(['Name', 'Employee ID', 'Specialization', 'Role', 'Joining Date', 'Status'])
            for record in queryset:
                writer.writerow([
                    record.user.get_full_name() or record.user.username,
                    record.employee_id,
                    record.subject_specialization,
                    record.role,
                    record.joining_date,
                    record.status
                ])

        return response
