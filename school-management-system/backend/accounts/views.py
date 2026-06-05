from rest_framework import status, views, permissions
from rest_framework.response import Response
from .serializers import UserSerializer
from core.permissions import IsAdmin

class UserCreateView(views.APIView):
    """
    Admin-only API to create new users (Students, Teachers, Admins).
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            # Automatically assign the creator's school if not provided
            school = serializer.validated_data.get('school') or request.user.school
            user = serializer.save(school=school)
            user.set_password(request.data.get('password'))
            user.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserProfileView(views.APIView):
    """
    GET the currently logged in user's profile details.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
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
            return Response(UserSerializer(user).data)

        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
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

        if len(new_password) < 6:
            return Response({'error': 'Password must be at least 6 characters'}, status=status.HTTP_400_BAD_REQUEST)

        if not request.user.check_password(old_password):
            return Response({'error': 'Old password is incorrect'}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_password)
        request.user.save()
        return Response({'message': 'Password updated successfully'}, status=status.HTTP_200_OK)


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
