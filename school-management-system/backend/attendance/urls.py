from django.urls import path
from .views import (
    AttendanceMarkView,
    TeacherAttendanceSheetView,
    TeacherAttendanceBulkSaveView,
    MyAttendanceView,
    MyAttendanceReportPDFView,
    TeacherClassAttendanceSummaryView,
    StudentPunchAttendanceView,
    TeacherAttendanceVerificationListView,
    TeacherAttendanceVerificationDecisionView,
    BiometricDevicePunchView,
)

urlpatterns = [
    path('mark/', AttendanceMarkView.as_view(), name='mark-attendance'),
    path('teacher/sheet/', TeacherAttendanceSheetView.as_view(), name='teacher-attendance-sheet'),
    path('teacher/save/', TeacherAttendanceBulkSaveView.as_view(), name='teacher-attendance-bulk-save'),
    path('punch/', StudentPunchAttendanceView.as_view(), name='attendance-punch'),
    path('biometric-punch/', BiometricDevicePunchView.as_view(), name='biometric-device-punch'),
    path('class-summary/', TeacherClassAttendanceSummaryView.as_view(), name='teacher-class-attendance-summary'),
    path('verification/', TeacherAttendanceVerificationListView.as_view(), name='teacher-attendance-verification'),
    path('verification/decision/<int:attendance_id>/', TeacherAttendanceVerificationDecisionView.as_view(), name='teacher-attendance-verification-decision'),
    path('my-attendance/', MyAttendanceView.as_view(), name='my-attendance'),
    path('my/report/pdf/', MyAttendanceReportPDFView.as_view(), name='my-attendance-report-pdf'),
]
