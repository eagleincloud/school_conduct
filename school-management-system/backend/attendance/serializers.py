from rest_framework import serializers

from .models import Attendance, BiometricDevice, generate_device_secret_key
from tenants.models import School

class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.name', read_only=True)

    class Meta:
        model = Attendance
        fields = [
            'id',
            'student',
            'student_name',
            'date',
            'status',
            'verification_status',
            'punch_time',
            'marked_by',
            'verified_by',
            'verified_at',
            'marked_via',
            'created_at',
        ]


class BiometricDeviceSerializer(serializers.ModelSerializer):
    school = serializers.SlugRelatedField(
        queryset=School.objects.all(),
        slug_field='school_id',
        required=False,
    )
    school_name = serializers.CharField(source='school.name', read_only=True)
    school_code = serializers.CharField(source='school.school_id', read_only=True)
    masked_secret_key = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()

    class Meta:
        model = BiometricDevice
        fields = [
            'id',
            'school',
            'school_name',
            'school_code',
            'name',
            'site_label',
            'device_type',
            'device_ip',
            'device_port',
            'device_password',
            'machine_number',
            'bridge_server_url',
            'device_secret_key',
            'masked_secret_key',
            'notes',
            'is_active',
            'last_seen_at',
            'last_punch_at',
            'last_tested_at',
            'last_test_status',
            'last_test_message',
            'status_label',
            'is_online',
            'created_at',
        ]
        extra_kwargs = {
            'device_secret_key': {'required': False, 'allow_blank': True},
            'school': {'required': False},
        }

    def get_masked_secret_key(self, obj):
        if not obj.device_secret_key:
            return ''
        if len(obj.device_secret_key) <= 8:
            return obj.device_secret_key
        return f"{obj.device_secret_key[:4]}...{obj.device_secret_key[-4:]}"

    def get_status_label(self, obj):
        return obj.get_live_status_label()

    def get_is_online(self, obj):
        return obj.is_online_now()

    def validate_device_port(self, value):
        if value < 1 or value > 65535:
            raise serializers.ValidationError('Device port must be between 1 and 65535.')
        return value

    def validate_machine_number(self, value):
        if value < 1:
            raise serializers.ValidationError('Machine number must be at least 1.')
        return value

    def validate(self, attrs):
        user = self.context['request'].user
        school = attrs.get('school')

        if user.role == 'admin':
            attrs['school'] = user.school
        elif user.role == 'superadmin':
            school = attrs.get('school') or getattr(self.instance, 'school', None)
            if school is None:
                raise serializers.ValidationError({'school': 'School is required for superadmin device management.'})
        else:
            raise serializers.ValidationError('You are not allowed to manage biometric devices.')

        secret_key = attrs.get('device_secret_key')
        if secret_key == '':
            attrs['device_secret_key'] = generate_device_secret_key()
        return attrs
