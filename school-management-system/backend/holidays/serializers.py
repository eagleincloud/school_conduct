from rest_framework import serializers

from classes.models import MainClass

from .models import Holiday


class MainClassShortSerializer(serializers.ModelSerializer):
    class Meta:
        model = MainClass
        fields = ['id', 'name']


class HolidaySerializer(serializers.ModelSerializer):
    """
    Admin create/update:
      - send `applicable_class_ids` (array of MainClass ids)
      - if array is empty/omitted => applies to all classes
    Response:
      - `applicable_classes` is a list of {id, name}
    """

    applicable_class_ids = serializers.PrimaryKeyRelatedField(
        source='applicable_classes',
        many=True,
        queryset=MainClass.objects.all(),
        required=False,
        allow_null=True,
    )
    applicable_classes = MainClassShortSerializer(many=True, read_only=True)

    class Meta:
        model = Holiday
        fields = [
            'id',
            'title',
            'start_date',
            'end_date',
            'description',
            'type',
            'applicable_class_ids',
            'applicable_classes',
        ]

    def create(self, validated_data):
        applicable_classes = validated_data.pop('applicable_classes', [])
        holiday = Holiday.objects.create(**validated_data)
        if applicable_classes:
            holiday.applicable_classes.set(applicable_classes)
        return holiday

    def update(self, instance, validated_data):
        applicable_classes = validated_data.pop('applicable_classes', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if applicable_classes is not None:
            # If empty list => all classes.
            instance.applicable_classes.set(applicable_classes)
        return instance


class HolidayListSerializer(serializers.ModelSerializer):
    applicable_classes = MainClassShortSerializer(many=True, read_only=True)

    class Meta:
        model = Holiday
        fields = ['id', 'title', 'start_date', 'end_date', 'type', 'description', 'applicable_classes']

