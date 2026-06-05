from rest_framework import serializers
from .models import MainClass, MainSection, ClassSection

class MainClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = MainClass
        fields = ['id', 'name', 'code', 'description']

class MainSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MainSection
        fields = '__all__'

class ClassSectionSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source='class_ref.name', read_only=True)
    section_name = serializers.CharField(source='section_ref.name', read_only=True)
    class_id = serializers.IntegerField(source='class_ref_id', read_only=True)
    section_id = serializers.IntegerField(source='section_ref_id', read_only=True)
    class_code = serializers.CharField(source='class_ref.code', read_only=True)
    class_teacher_name = serializers.SerializerMethodField()
    shift_name = serializers.ReadOnlyField(source='assigned_shift.name')
    room_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = ClassSection
        fields = [
            'id',
            'class_id',
            'section_id',
            'class_name',
            'class_code',
            'section_name',
            'class_teacher',
            'class_teacher_name',
            'assigned_shift',
            'shift_name',
            'room_number',
            'student_count',
        ]

    def get_class_teacher_name(self, obj):
        if not obj.class_teacher:
            return None
        return obj.class_teacher.user.name or obj.class_teacher.user.username

    def get_student_count(self, obj):
        return obj.students.count()
