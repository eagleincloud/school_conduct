from django.urls import path
from .views import (
    ExamDetailView,
    ExamListCreateView,
    ExamResultDashboardView,
    ExamSubjectStatusView,
    ExamScheduleDetailView,
    ExamScheduleListCreateView,
    TeacherExamSubjectsView,
    ClassSectionTeacherSubjectsView,
    MyResultsView,
    MyResultMarksheetPDFView,
    PublishResultView,
    ResultUploadView,
    ExamDetailedStatusView,
)

urlpatterns = [
    path('exams/', ExamListCreateView.as_view(), name='exam-list-create'),
    path('exams/<int:exam_id>/', ExamDetailView.as_view(), name='exam-detail'),
    path('exams/<int:exam_id>/schedule/', ExamScheduleListCreateView.as_view(), name='exam-schedule'),
    path('schedule/<int:schedule_id>/', ExamScheduleDetailView.as_view(), name='schedule-detail'),
    path('exams/<int:exam_id>/result-dashboard/', ExamResultDashboardView.as_view(), name='exam-result-dashboard'),
    path('exams/<int:exam_id>/subject-status/', ExamSubjectStatusView.as_view(), name='exam-subject-status'),
    path('exams/<int:exam_id>/teacher-subjects/', TeacherExamSubjectsView.as_view(), name='exam-teacher-subjects'),
    path('class-sections/<int:class_section_id>/teacher-subjects/', ClassSectionTeacherSubjectsView.as_view(), name='class-section-teacher-subjects'),
    path('exams/<int:exam_id>/publish-results/', PublishResultView.as_view(), name='exam-publish-results'),
    path('exams/<int:exam_id>/detailed-status/', ExamDetailedStatusView.as_view(), name='exam-detailed-status'),
    path('results/upload/', ResultUploadView.as_view(), name='result-upload'),
    path('results/my/', MyResultsView.as_view(), name='my-results'),
    path('results/my/<int:exam_id>/pdf/', MyResultMarksheetPDFView.as_view(), name='my-marksheet-pdf'),
]
