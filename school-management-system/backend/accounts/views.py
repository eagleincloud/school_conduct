from rest_framework import status, views, permissions
from rest_framework.response import Response
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import ProfileUpdateSerializer, UserCreateSerializer, UserSerializer
from core.permissions import IsAdmin

class UserCreateView(views.APIView):
    """
    Admin-only API to create new users (Students, Teachers, Admins).
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = UserCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.save()
            return Response(UserSerializer(user, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserProfileView(views.APIView):
    """
    GET the currently logged in user's profile details.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user, context={'request': request})
        return Response(serializer.data)

from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

class UpdateProfileView(views.APIView):
    """
    PATCH or PUT to update user details (name, phone, profile_photo).
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]


    def patch(self, request):
        user = request.user
        
        # Handle 'delete_photo' flag
        if request.data.get('delete_photo') == 'true':
            if user.profile_photo:
                user.profile_photo.delete(save=False)
            user.profile_photo = None
            user.save()
            return Response(UserSerializer(user, context={'request': request}).data)

        serializer = ProfileUpdateSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(UserSerializer(user, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class ChangePasswordView(views.APIView):
    """
    Allow logged-in user to change their own password.
    Expected payload: { old_password, new_password, confirm_password }
    """

    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not old_password or not new_password or not confirm_password:
            return Response({'error': 'old_password, new_password and confirm_password are required'}, status=status.HTTP_400_BAD_REQUEST)

        if new_password != confirm_password:
            return Response({'error': 'New password and confirm password do not match'}, status=status.HTTP_400_BAD_REQUEST)

        if not request.user.check_password(old_password):
            return Response({'error': 'Old password is incorrect'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_password, user=request.user)
        except DjangoValidationError as exc:
            return Response({'new_password': list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_password)
        request.user.is_first_login = False
        request.user.save()
        return Response({'message': 'Password updated successfully'}, status=status.HTTP_200_OK)


class FirstLoginResetPasswordView(views.APIView):
    """
    Reset password on first login. Requires the user to be authenticated.
    Expected payload: { new_password, confirm_password }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not new_password or not confirm_password:
            return Response({'error': 'new_password and confirm_password are required'}, status=status.HTTP_400_BAD_REQUEST)

        if new_password != confirm_password:
            return Response({'error': 'New password and confirm password do not match'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if not user.is_first_login:
            return Response({'error': 'This is not your first login or password already reset'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            return Response({'new_password': list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.is_first_login = False
        user.save()
        return Response({'message': 'Password reset successfully'}, status=status.HTTP_200_OK)


class LogoutView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'refresh': 'This field is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            RefreshToken(refresh_token).blacklist()
        except Exception:
            return Response({'refresh': 'Invalid refresh token.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminDashboardStatsView(views.APIView):
    """
    Admin-only stats used by the Admin Dashboard cards.
    Frontend expects:
      { success: true, data: { total_students, total_teachers, ... } }
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        from students.models import StudentProfile
        from teachers.models import TeacherProfile
        from classes.models import MainClass, MainSection

        school = request.user.school

        stats = {
            "total_students": StudentProfile.objects.filter(user__school=school).count() if not request.user.is_superuser else StudentProfile.objects.count(),
            "total_teachers": TeacherProfile.objects.filter(user__school=school).count() if not request.user.is_superuser else TeacherProfile.objects.count(),
            "active_classes": MainClass.objects.filter(school=school).count() if not request.user.is_superuser else MainClass.objects.count(),
            "total_sections": MainSection.objects.filter(school=school).count() if not request.user.is_superuser else MainSection.objects.count(),
        }
        return Response(
            {"success": True, "message": "Admin stats generated", "data": stats},
            status=status.HTTP_200_OK,
        )
