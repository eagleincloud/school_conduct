from django.urls import path

from .views import (
    AdminSyllabusControlView,
    SyllabusDetailView,
    SyllabusListView,
    StudentSyllabusDownloadView,
    StudentSyllabusFiltersView,
)

urlpatterns = [
    # General List (Role-based filtering)
    path('', SyllabusListView.as_view(), name='syllabus-list'),
    
    # Filters
    path('student-filters/', StudentSyllabusFiltersView.as_view(), name='student-syllabus-filters'),
    
    # Detail / View
    path('<int:syllabus_id>/', SyllabusDetailView.as_view(), name='syllabus-detail'),
    
    # Admin Control (Upload / Edit / Delete)
    path('control/', AdminSyllabusControlView.as_view(), name='admin-syllabus-control'),
    path('control/<int:syllabus_id>/', AdminSyllabusControlView.as_view(), name='admin-syllabus-control-detail'),
    
    # Download
    path('download/<int:syllabus_id>/', StudentSyllabusDownloadView.as_view(), name='syllabus-download'),
]
