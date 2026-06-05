from accounts.models import User

from .models import Notification, Message

class CommunicationService:
    @staticmethod
    def create_notification(user_id, title, message):
        role = User.objects.filter(pk=user_id).values_list('role', flat=True).first() or 'student'
        return Notification.objects.create(
            user_id=user_id, target_role=role, title=title, message=message
        )
