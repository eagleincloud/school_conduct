import ipaddress

from rest_framework import serializers

from .models import Attendance, BiometricDevice, TeacherAttendance, generate_device_secret_key
from tenants.models import School


def _normalize_host_ip(value):
    raw = (value or "").strip()
    if not raw:
        return raw

    try:
        if "/" in raw:
            interface = ipaddress.ip_interface(raw)
            return str(interface.ip)
        return str(ipaddress.ip_address(raw))
    except ValueError:
        if "." in raw:
            parts = raw.split(".")
            if len(parts) == 4 and all(part.isdigit() for part in parts):
                try:
                    normalized = ".".join(str(int(part)) for part in parts)
                    return str(ipaddress.ip_address(normalized))
                except ValueError:
                    pass
        return raw

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
    device_ip = serializers.CharField()
    allowed_source_ip = serializers.CharField(required=False, allow_blank=True, allow_null=True)
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
            'integration_mode',
            'device_ip',
            'device_port',
            'device_password',
            'machine_number',
            'device_serial_number',
            'terminal_id',
            'allowed_source_ip',
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
            'last_event_type',
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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['device_ip'] = _normalize_host_ip(data.get('device_ip'))
        data['allowed_source_ip'] = _normalize_host_ip(data.get('allowed_source_ip'))
        return data

    def validate_device_ip(self, value):
        normalized = _normalize_host_ip(value)
        try:
            ipaddress.ip_address(normalized)
        except ValueError as exc:
            raise serializers.ValidationError('Enter a valid IP address.') from exc
        return normalized

    def validate_allowed_source_ip(self, value):
        if value in (None, ""):
            return None

        normalized = _normalize_host_ip(value)
        try:
            ipaddress.ip_address(normalized)
        except ValueError as exc:
            raise serializers.ValidationError('Enter a valid public IP allowlist value.') from exc
        return normalized

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

        integration_mode = attrs.get('integration_mode') or getattr(self.instance, 'integration_mode', 'bridge_pull')
        device_serial_number = (attrs.get('device_serial_number') or getattr(self.instance, 'device_serial_number', '') or '').strip()
        terminal_id = (attrs.get('terminal_id') or getattr(self.instance, 'terminal_id', '') or '').strip()
        allowed_source_ip = attrs.get('allowed_source_ip') or getattr(self.instance, 'allowed_source_ip', None)

        if integration_mode in {'tcp_xml_push', 'http_push'} and not device_serial_number and not (terminal_id and allowed_source_ip):
            raise serializers.ValidationError({
                'device_serial_number': 'Provide a device serial number, or provide both Terminal ID and Allowed Source IP for direct push devices.'
            })

        if device_serial_number:
            duplicate_qs = BiometricDevice.objects.filter(device_serial_number__iexact=device_serial_number)
            if self.instance:
                duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)
            if duplicate_qs.exists():
                raise serializers.ValidationError({'device_serial_number': 'This serial number is already registered to another biometric device.'})
        return attrs


class TeacherAttendanceSerializer(serializers.ModelSerializer):
    teacher_name = serializers.CharField(source='teacher.user.name', read_only=True)
    employee_id = serializers.CharField(source='teacher.employee_id', read_only=True)

    class Meta:
        model = TeacherAttendance
        fields = [
            'id',
            'teacher',
            'teacher_name',
            'employee_id',
            'date',
            'status',
            'punch_in_time',
            'punch_out_time',
            'marked_via',
            'marked_by',
            'notes',
            'created_at',
        ]
