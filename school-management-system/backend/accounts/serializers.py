from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'name', 'role', 'phone', 'school', 'profile_photo']



class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT serializer that includes user data (role, name, etc.)
    in the login response so the frontend can use it directly.
    """

    def validate(self, attrs):
        username = attrs.get('username')
        if '@' in username:
            # If an email is provided, find the corresponding user's username
            user_obj = User.objects.filter(email__iexact=username).first()
            if user_obj:
                attrs['username'] = user_obj.username

        data = super().validate(attrs)

        # Add user info to the response
        user = self.user
        request = self.context.get('request')
        
        # Superadmins and Dealers don't belong to any school and bypass school check
        is_platform_role = user.is_superuser or user.role == 'dealer'
        
        if not is_platform_role:
            if not user.school:
                raise serializers.ValidationError("This user is not assigned to any school.")
            
            if not user.school.is_active:
                raise serializers.ValidationError("Your school account is suspended. Please contact support.")

        # Build logo URL: use absolute URI so frontend can display it directly
        school_logo_url = None
        if not is_platform_role and user.school and user.school.logo:
            school_logo_url = request.build_absolute_uri(user.school.logo.url)

        data['user'] = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'name': user.name or user.username,
            'role': 'superadmin' if user.is_superuser else user.role,
            'school_id': getattr(user.school, 'school_id', None),
            'school_name': getattr(user.school, 'name', None),
            'school_logo': school_logo_url,
            'profile_photo': request.build_absolute_uri(user.profile_photo.url) if user.profile_photo else None,
        }

        if user.role == 'student':
            sp = getattr(user, 'student_profile', None)
            if sp:
                data['user']['student_profile_id'] = sp.id


        return data
