from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from classes.models import MainClass

from .models import Announcement


class MainClassMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = MainClass
        fields = ['id', 'name']


class AnnouncementSerializer(serializers.ModelSerializer):
    class_id = serializers.PrimaryKeyRelatedField(
        source='class_ref',
        queryset=MainClass.objects.all(),
        required=False,
        allow_null=True,
    )
    class_meta = MainClassMiniSerializer(source='class_ref', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    attachment_url = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(read_only=True)
    is_holiday_window = serializers.BooleanField(read_only=True)

    class Meta:
        model = Announcement
        fields = [
            'id',
            'title',
            'description',
            'type',
            'start_date',
            'end_date',
            'target_audience',
            'class_id',
            'class_meta',
            'attachment',
            'attachment_url',
            'is_important',
            'is_pinned',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
            'is_active',
            'is_holiday_window',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_attachment_url(self, obj):
        req = self.context.get('request')
        if obj.attachment and hasattr(obj.attachment, 'url'):
            url = obj.attachment.url
            if req:
                return req.build_absolute_uri(url)
            return url
        return None

    def validate(self, data):
        inst = self.instance
        start = data.get('start_date', getattr(inst, 'start_date', None) if inst else None)
        end = data.get('end_date', getattr(inst, 'end_date', None) if inst else None)
        if start and end and end < start:
            raise ValidationError({'end_date': 'End date must be on or after start date.'})
        return data

    def create(self, validated_data):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        school = getattr(user, 'school', None) if user and user.is_authenticated else None
        class_ref = validated_data.get('class_ref')
        if school is None and class_ref is not None:
            school = getattr(class_ref, 'school', None)
        if school is None and user and getattr(user, 'is_superuser', False):
            from tenants.models import School

            school = School.objects.filter(is_active=True).order_by('pk').first()
        validated_data['school'] = school
        validated_data['created_by'] = user if user and user.is_authenticated else None
        return super().create(validated_data)

    def update(self, instance, validated_data):
        inst = super().update(instance, validated_data)
        if inst.school_id is None and inst.class_ref_id:
            cr = inst.class_ref
            if cr and cr.school_id:
                inst.school_id = cr.school_id
                inst.save(update_fields=['school'])
        return inst
