from django.urls import path
from .views import (
    AdminAssignStudentSectionView,
    AdminClassSectionCreateView,
    AdminClassSectionDetailView,
    AdminClassSectionHierarchyView,
    AdminClassSectionListView,
    AdminMainClassDetailView,
    AdminMainClassCreateView,
    AdminMainSectionCreateView,
    ClassSectionListView,
    MainClassListView,
    MainSectionListView,
    TeacherTeachingSectionsView,
)

urlpatterns = [
    path('sections/', ClassSectionListView.as_view(), name='class-sections-list'),
    path('teaching-sections/', TeacherTeachingSectionsView.as_view(), name='class-teaching-sections'),
    path('main-classes/', MainClassListView.as_view(), name='main-classes-list'),
    path('main-sections/', MainSectionListView.as_view(), name='main-sections-list'),
    path('admin-create-class/', AdminMainClassCreateView.as_view(), name='admin-create-class'),
    path('admin-create-section/', AdminMainSectionCreateView.as_view(), name='admin-create-section'),
    path('admin-class/<int:class_id>/', AdminMainClassDetailView.as_view(), name='admin-class-detail'),
    path('admin-sections/', AdminClassSectionListView.as_view(), name='admin-sections-list'),
    path('admin-sections/create/', AdminClassSectionCreateView.as_view(), name='admin-sections-create'),
    path('admin-sections/<int:section_id>/', AdminClassSectionDetailView.as_view(), name='admin-sections-detail'),
    path('admin-structure/', AdminClassSectionHierarchyView.as_view(), name='admin-structure'),
    path('admin-assign-student/', AdminAssignStudentSectionView.as_view(), name='admin-assign-student'),
]
