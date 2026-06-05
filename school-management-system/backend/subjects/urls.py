from django.urls import path

from .views import (
    SubjectListView,
    SubjectCreateView,
    SubjectUpdateDeleteView,
    SubjectDetailsView,
    SubjectNoteListCreateView,
    SubjectNoteDeleteView,
    SubjectAssignmentListCreateView,
    SubjectAssignmentDeleteView,
    SubjectMarksView,
    TeacherAssignmentListCreateView,
    TeacherAssignmentDetailView,
)

urlpatterns = [
    path('', SubjectListView.as_view(), name='subjects-list'),
    path('create/', SubjectCreateView.as_view(), name='subjects-create'),
    path('<int:subject_id>/', SubjectUpdateDeleteView.as_view(), name='subjects-update-delete'),
    path('<int:subject_id>/details/', SubjectDetailsView.as_view(), name='subjects-details'),
    path('<int:subject_id>/notes/', SubjectNoteListCreateView.as_view(), name='subject-notes'),
    path('notes/<int:note_id>/', SubjectNoteDeleteView.as_view(), name='subject-note-delete'),
    path('<int:subject_id>/assignments/', SubjectAssignmentListCreateView.as_view(), name='subject-assignments'),
    path('assignments/<int:assignment_id>/', SubjectAssignmentDeleteView.as_view(), name='subject-assignment-delete'),
    path('<int:subject_id>/marks/', SubjectMarksView.as_view(), name='subject-marks'),
    path('teacher-assignments/', TeacherAssignmentListCreateView.as_view(), name='teacher-assignments-list-create'),
    path('teacher-assignments/<int:assignment_id>/', TeacherAssignmentDetailView.as_view(), name='teacher-assignments-detail'),
]

