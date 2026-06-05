from django.urls import path

from .views import AnnouncementDetailView, AnnouncementListCreateView, AnnouncementNotifyView

urlpatterns = [
    path('', AnnouncementListCreateView.as_view(), name='announcement-list-create'),
    path('<int:pk>/notify/', AnnouncementNotifyView.as_view(), name='announcement-notify'),
    path('<int:pk>/', AnnouncementDetailView.as_view(), name='announcement-detail'),
]
