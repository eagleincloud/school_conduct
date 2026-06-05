from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Attendance
from communication.models import Notification

@receiver(post_save, sender=Attendance)
def notify_student_on_attendance(sender, instance, created, **kwargs):
    """
    Auto-create a notification for the student whenever attendance is verified.
    """
    # For pending punches, teacher verification is still required.
    # Avoid spamming student with "marked" messages before verification.
    if getattr(instance, 'verification_status', None) == 'pending':
        return

    student_user = instance.student.user
    verification = (instance.verification_status or '').upper()
    title = f"Attendance {verification}"
    message = f"Your attendance for {instance.date} was {verification} by teacher verification."

    Notification.objects.create(
        user=student_user,
        target_role=getattr(student_user, 'role', None) or 'student',
        title=title,
        message=message,
    )
