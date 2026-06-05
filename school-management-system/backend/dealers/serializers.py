from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Dealer
from tenants.models import School

User = get_user_model()

class DealerSchoolBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ['id', 'name', 'school_id', 'is_active']

class DealerSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)
    school_count = serializers.SerializerMethodField()
    schools = DealerSchoolBasicSerializer(many=True, read_only=True)
    
    # Writeable fields for creation
    admin_username = serializers.CharField(write_only=True)
    admin_email = serializers.EmailField(write_only=True)
    admin_password = serializers.CharField(write_only=True)

    class Meta:
        model = Dealer
        fields = [
            'id', 'name', 'contact', 'location', 'created_at', 
            'username', 'email', 'is_active', 'school_count', 'schools',
            'admin_username', 'admin_email', 'admin_password'
        ]
        read_only_fields = ['created_at']

    def get_school_count(self, obj):
        return obj.schools.count()

    def create(self, validated_data):
        admin_username = validated_data.pop('admin_username')
        admin_email = validated_data.pop('admin_email')
        admin_password = validated_data.pop('admin_password')
        
        if User.objects.filter(username=admin_username).exists():
            raise serializers.ValidationError({"admin_username": "Username already exists."})
        if User.objects.filter(email=admin_email).exists():
            raise serializers.ValidationError({"admin_email": "Email already exists."})
            
        user = User.objects.create_user(
            username=admin_username,
            email=admin_email,
            password=admin_password,
            role='dealer'
        )
        
        dealer = Dealer.objects.create(user=user, **validated_data)
        return dealer

class DealerSchoolSerializer(serializers.ModelSerializer):
    admin_name = serializers.CharField(write_only=True, required=False)
    admin_email = serializers.EmailField(write_only=True, required=False)
    admin_username = serializers.CharField(write_only=True, required=False)
    admin_password = serializers.CharField(write_only=True, required=False)
    admin_phone = serializers.CharField(write_only=True, required=False)
    student_count = serializers.SerializerMethodField()
    teacher_count = serializers.SerializerMethodField()

    class Meta:
        model = School
        fields = [
            'id', 'name', 'school_id', 'location', 'logo', 'about', 
            'contact_email', 'is_active', 'created_at',
            'admin_name', 'admin_email', 'admin_username', 'admin_password', 'admin_phone',
            'student_count', 'teacher_count'
        ]
        read_only_fields = ['created_at']

    def get_student_count(self, obj):
        try:
            return obj.students.count()
        except:
            return 0

    def get_teacher_count(self, obj):
        try:
            return obj.user_set.filter(role='teacher').count()
        except:
            return 0

    def validate_location(self, value):
        dealer = self.context['request'].user.dealer_profile
        if value != dealer.location:
            raise serializers.ValidationError(f"School location must match dealer location: {dealer.location}")
        return value

    def create(self, validated_data):
        admin_name = validated_data.pop('admin_name', None)
        admin_email = validated_data.pop('admin_email', None)
        admin_username = validated_data.pop('admin_username', None)
        admin_password = validated_data.pop('admin_password', None)
        admin_phone = validated_data.pop('admin_phone', None)

        dealer = self.context['request'].user.dealer_profile
        validated_data['dealer'] = dealer
        # If location not provided, use dealer's location
        if 'location' not in validated_data or not validated_data['location']:
            validated_data['location'] = dealer.location

        # Ensure school is active by default
        if 'is_active' not in validated_data:
            validated_data['is_active'] = True

        school = super().create(validated_data)

        if admin_email and admin_username and admin_password:
            # Check if email/username already exists
            if User.objects.filter(email=admin_email).exists() or User.objects.filter(username=admin_username).exists():
                raise serializers.ValidationError("A user with this email or username already exists.")
                
            User.objects.create_user(
                username=admin_username,
                email=admin_email,
                password=admin_password,
                name=admin_name or admin_username,
                role='admin',
                school=school,
                phone=admin_phone,
                is_staff=True
            )
        
        return school

class DealerSelfProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email')

    class Meta:
        model = Dealer
        fields = ['id', 'name', 'contact', 'location', 'username', 'email']

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        email = user_data.get('email')

        if email:
            user = instance.user
            if User.objects.filter(email=email).exclude(id=user.id).exists():
                raise serializers.ValidationError({"email": "This email is already in use by another account."})
            user.email = email
            user.save()

        return super().update(instance, validated_data)

