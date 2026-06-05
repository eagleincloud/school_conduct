from django.urls import path

from .views import HolidayDetailView, HolidayListCreateView, HolidayExportCSVView

urlpatterns = [
    path('', HolidayListCreateView.as_view(), name='holiday-list-create'),
    path('<int:pk>/', HolidayDetailView.as_view(), name='holiday-detail'),
    path('export/csv/', HolidayExportCSVView.as_view(), name='holiday-export-csv'),
]

