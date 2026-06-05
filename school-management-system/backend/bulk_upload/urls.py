from django.urls import path
from .views import ValidateUploadAPIView, ConfirmImportAPIView, HistoryAPIView

urlpatterns = [
    path('validate/', ValidateUploadAPIView.as_view(), name='bulk-upload-validate'),
    path('confirm/', ConfirmImportAPIView.as_view(), name='bulk-upload-confirm'),
    path('history/', HistoryAPIView.as_view(), name='bulk-upload-history'),
    path('history/<int:log_id>/', HistoryAPIView.as_view(), name='bulk-upload-history-delete'),
]
