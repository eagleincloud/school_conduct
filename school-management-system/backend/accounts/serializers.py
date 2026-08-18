from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password
from .models import User


class UserSerializer(serializers.ModelSerializer):
    profile_photo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'name', 'role', 'phone', 'school', 'profile_photo']
        read_only_fields = fields

    def get_profile_photo(self, obj):
        request = self.context.get('request')
        photo = None
        if obj.role == 'student':
            sp = getattr(obj, 'student_profile', None)
            if sp and sp.photo:
                photo = sp.photo
        elif obj.role == 'teacher':
            tp = getattr(obj, 'teacher_profile', None)
            if tp and tp.photo:
                photo = tp.photo
        
        if not photo:
            photo = obj.profile_photo

        if photo:
            try:
                if request:
                    return request.build_absolute_uri(photo.url)
                return photo.url
            except Exception:
                return None
        return None


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Fields a user is allowed to change on their own account."""

    class Meta:
        model = User
        fields = ['email', 'name', 'phone', 'profile_photo']


class UserCreateSerializer(serializers.ModelSerializer):
    """School-admin user creation without role or tenant escalation."""

    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'name', 'role', 'phone', 'school', 'password']
        read_only_fields = ['id']

    def validate_role(self, value):
        if value not in {'admin', 'teacher', 'student'}:
            raise serializers.ValidationError('School administrators may only create school users.')
        return value

    def validate(self, attrs):
        request = self.context['request']
        requested_school = attrs.get('school')

        if request.user.is_superuser:
            if requested_school is None:
                raise serializers.ValidationError({'school': 'A school is required.'})
        else:
            if request.user.school_id is None:
                raise serializers.ValidationError('Your account is not assigned to a school.')
            if requested_school and requested_school.pk != request.user.school_id:
                raise serializers.ValidationError({'school': 'You cannot create users for another school.'})
            attrs['school'] = request.user.school

        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user



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
            try:
                school_logo_url = request.build_absolute_uri(user.school.logo.url)
            except Exception:
                school_logo_url = None

        photo = None
        if user.role == 'student':
            sp = getattr(user, 'student_profile', None)
            if sp and sp.photo:
                photo = sp.photo
        elif user.role == 'teacher':
            tp = getattr(user, 'teacher_profile', None)
            if tp and tp.photo:
                photo = tp.photo
        
        if not photo:
            photo = user.profile_photo

        profile_photo_url = None
        if photo:
            try:
                profile_photo_url = request.build_absolute_uri(photo.url) if request else photo.url
            except Exception:
                profile_photo_url = None

        data['user'] = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'name': user.name or user.username,
            'role': 'superadmin' if user.is_superuser else user.role,
            'school_id': getattr(user.school, 'school_id', None),
            'school_name': getattr(user.school, 'name', None),
            'school_logo': school_logo_url,
            'profile_photo': profile_photo_url,
            'is_first_login': user.is_first_login,
        }

        if user.role == 'student':
            sp = getattr(user, 'student_profile', None)
            if sp:
                data['user']['student_profile_id'] = sp.id


        return data
