from django.urls import path
from .views import (
    AssignmentListView,
    AssignmentCreateView,
    AssignmentDetailView,
    MyAssignmentSubmissionsView,
    StudentAssignmentSubmissionCreateView,
    AssignmentSubmissionsListView,
)


urlpatterns = [
    path('', AssignmentListView.as_view(), name='assignment-list'),
    path('create/', AssignmentCreateView.as_view(), name='assignment-create'),
    path('<int:assignment_id>/', AssignmentDetailView.as_view(), name='assignment-detail'),
    path('my-submissions/', MyAssignmentSubmissionsView.as_view(), name='my-assignment-submissions'),
    path('submit/', StudentAssignmentSubmissionCreateView.as_view(), name='assignment-submit'),
    path('<int:assignment_id>/submissions/', AssignmentSubmissionsListView.as_view(), name='assignment-submissions'),
]

