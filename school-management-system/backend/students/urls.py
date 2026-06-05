from django.urls import path
from .views import (
    AdminStudentCreateView,
    StudentListView,
    StudentDetailView,
    StudentDeleteView,
    StudentUpdateView,
    StudentsByClassSectionView,
    StudentProfileView,
    StudentProfilePhotoView,
    StudentIdCardPdfView,
    SiblingListView,
    SiblingDashboardView,
)

urlpatterns = [
    path('', StudentListView.as_view(), name='students-list'),
    path('profile/photo/', StudentProfilePhotoView.as_view(), name='student-profile-photo'),
    path('profile/id-card/', StudentIdCardPdfView.as_view(), name='student-profile-id-card'),
    path('profile/', StudentProfileView.as_view(), name='student-profile'),
    path('admin-create/', AdminStudentCreateView.as_view(), name='admin-student-create'),
    path('detail/<int:student_id>/', StudentDetailView.as_view(), name='student-detail'),
    path('delete/<int:student_id>/', StudentDeleteView.as_view(), name='student-delete'),
    path('update/<int:student_id>/', StudentUpdateView.as_view(), name='student-update'),
    path('by-class/<int:class_section_id>/', StudentsByClassSectionView.as_view(), name='students-by-class'),
    path('siblings/', SiblingListView.as_view(), name='sibling-list'),
    path('dashboard/', SiblingDashboardView.as_view(), name='sibling-dashboard'),
]
