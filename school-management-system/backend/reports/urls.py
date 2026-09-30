from django.urls import path
from .views import (
    AdminReportDownloadView,
    StudentListPreviewView,
    TeacherListPreviewView,
    StudentAttendancePreviewView,
    TeacherAttendancePreviewView,
    StudentAttendanceDiaryView,
    TeacherAttendanceDiaryView,
    MarksPreviewView,
    StudentListDropdownView,
    TeacherListDropdownView,
)

urlpatterns = [
    # Download (CSV)
    path('download/', AdminReportDownloadView.as_view(), name='report-download'),

    # Preview (JSON for on-screen tables)
    path('preview/students/', StudentListPreviewView.as_view(), name='report-preview-students'),
    path('preview/teachers/', TeacherListPreviewView.as_view(), name='report-preview-teachers'),
    path('preview/student-attendance/', StudentAttendancePreviewView.as_view(), name='report-preview-student-attendance'),
    path('preview/teacher-attendance/', TeacherAttendancePreviewView.as_view(), name='report-preview-teacher-attendance'),
    path('preview/student-attendance-diary/', StudentAttendanceDiaryView.as_view(), name='report-preview-student-attendance-diary'),
    path('preview/teacher-attendance-diary/', TeacherAttendanceDiaryView.as_view(), name='report-preview-teacher-attendance-diary'),
    path('preview/marks/', MarksPreviewView.as_view(), name='report-preview-marks'),

    # Lightweight dropdown lists
    path('students-dropdown/', StudentListDropdownView.as_view(), name='report-students-dropdown'),
    path('teachers-dropdown/', TeacherListDropdownView.as_view(), name='report-teachers-dropdown'),
]

