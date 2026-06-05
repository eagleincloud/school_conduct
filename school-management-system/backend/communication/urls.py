from django.urls import path
from .views import (
    MyNotificationsView,
    NotificationDetailView,
    NotificationMarkAllReadView,
    MessageThreadsView,
    ConversationView,
    DoubtConversationListView,
    DoubtConversationDetailView,
    MarkResolvedView,
    DoubtMessageDetailView,
)


urlpatterns = [
    path('my/', MyNotificationsView.as_view(), name='my-notifications'),
    path('my/mark-all-read/', NotificationMarkAllReadView.as_view(), name='my-notifications-mark-all-read'),
    path('my/<int:notification_id>/', NotificationDetailView.as_view(), name='my-notification-detail'),
    path('threads/', MessageThreadsView.as_view(), name='message-threads'),
    path('conversation/<int:other_user_id>/', ConversationView.as_view(), name='message-conversation'),
    
    # Doubt System
    path('doubts/', DoubtConversationListView.as_view(), name='doubts-list'),
    path('doubts/<int:conversation_id>/', DoubtConversationDetailView.as_view(), name='doubts-detail'),
    path('doubts/<int:conversation_id>/resolve/', MarkResolvedView.as_view(), name='doubts-resolve'),
    path('doubts/message/<int:message_id>/', DoubtMessageDetailView.as_view(), name='doubts-message-detail'),
]


