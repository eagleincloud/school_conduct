from django.urls import path
from .views import (
    AdminTeacherCreateView,
    TeacherListView,
    TeacherDetailView,
    TeacherDeleteView,
    TeacherUpdateView,
    TeacherProfileView,
    TeacherProfilePhotoView,
    TeacherIdCardPdfView,
    TeacherIdCardPdfView,
    TeacherDocumentsView,
    TeacherListAllView,
)


urlpatterns = [
    path('', TeacherListView.as_view(), name='teachers-list'),
    path('profile/photo/', TeacherProfilePhotoView.as_view(), name='teacher-profile-photo'),
    path('profile/id-card/', TeacherIdCardPdfView.as_view(), name='teacher-profile-id-card'),
    path('profile/documents/', TeacherDocumentsView.as_view(), name='teacher-profile-documents'),
    path('profile/', TeacherProfileView.as_view(), name='teacher-profile'),
    path('admin/create-teacher/', AdminTeacherCreateView.as_view(), name='admin-create-teacher'),
    path('detail/<int:teacher_id>/', TeacherDetailView.as_view(), name='teacher-detail'),
    path('delete/<int:teacher_id>/', TeacherDeleteView.as_view(), name='teacher-delete'),
    path('update/<int:teacher_id>/', TeacherUpdateView.as_view(), name='teacher-update'),
    path('list-all/', TeacherListAllView.as_view(), name='teachers-list-all'),
]

