from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.core.mail import send_mail
from django.conf import settings
from .forms import EnquiryForm
import logging

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([AllowAny])
def submit_enquiry(request):
    form = EnquiryForm(request.data)
    if form.is_valid():
        try:
            enquiry = form.save()

            # Send email to admin
            admin_subject = f"New Enquiry from {enquiry.name}: {enquiry.subject}"
            admin_message = f"Name: {enquiry.name}\nEmail: {enquiry.email}\nSubject: {enquiry.subject}\n\nMessage:\n{enquiry.message}"
            
            try:
                send_mail(
                    subject=admin_subject,
                    message=admin_message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[settings.CONTACT_EMAIL],
                    fail_silently=False,
                )
                print(f"✅ Admin notification email sent to {settings.CONTACT_EMAIL}")
            except Exception as e:
                print(f"❌ Failed to send admin email: {e}")
                logger.error(f"Failed to send admin notification email: {e}")

            # confirmation email to user
            user_subject = f"Enquiry Received: {enquiry.subject}"
            user_message = f"Hello {enquiry.name},\n\nThank you for reaching out. We have received your enquiry and will get back to you shortly.\n\nBest,\nSchool Conduct Team"
            
            try:
                send_mail(
                    subject=user_subject,
                    message=user_message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[enquiry.email],
                    fail_silently=False,
                )
                print(f"✅ Confirmation email sent to {enquiry.email}")
            except Exception as e:
                print(f"❌ Failed to send user email: {e}")
                logger.error(f"Failed to send user confirmation email: {e}")

            return Response({"status": "success", "message": "Enquiry submitted successfully!"})
        except Exception as e:
            logger.error(f"Error saving enquiry: {e}")
            return Response({"status": "error", "message": "Internal server error"}, status=500)
    
    return Response({"status": "error", "message": "Invalid form data", "errors": form.errors}, status=400)

