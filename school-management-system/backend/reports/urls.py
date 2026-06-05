from django.urls import path
from .views import AdminReportDownloadView

urlpatterns = [
    path('download/', AdminReportDownloadView.as_view(), name='report-download'),
]
