from rest_framework import serializers
from .models import ClassFeeCard, FeeStructure, StudentFee, Payment


class ClassFeeCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassFeeCard
        fields = [
            'id',
            'class_name',
            'registration_fee',
            'admission_fee',
            'tuition_fee',
            'computer_fee',
            'annual_charges',
            'science_fee',
            'sports_fee',
            'total_fee',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['total_fee', 'created_at', 'updated_at']


class FeeStructureSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source='class_ref.name', read_only=True)

    class Meta:
        model = FeeStructure
        fields = [
            'id',
            'class_ref',
            'class_name',
            'tuition_fees',
            'exam_fees',
            'other_charges',
            'total_fees',
            'due_date',
            'description',
        ]
        read_only_fields = ['total_fees']


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            'id',
            'student_fee',
            'amount',
            'payment_date',
            'payment_mode',
            'transaction_id',
            'created_at',
        ]
        read_only_fields = ['created_at']


class StudentFeeSerializer(serializers.ModelSerializer):
    """Full detail for admin / student dashboards."""

    total_fees = serializers.SerializerMethodField()
    due_amount = serializers.SerializerMethodField()
    student_name = serializers.CharField(source='student.user.name', read_only=True)
    admission_number = serializers.CharField(source='student.admission_number', read_only=True)
    class_display = serializers.SerializerMethodField()
    fee_breakdown = serializers.SerializerMethodField()
    overdue = serializers.SerializerMethodField()
    payments = PaymentSerializer(many=True, read_only=True)

    def get_total_fees(self, obj):
        return str(obj.fee_structure.total_fees)

    def get_due_amount(self, obj):
        return str(obj.due_amount)

    class Meta:
        model = StudentFee
        fields = [
            'id',
            'student',
            'student_name',
            'admission_number',
            'class_display',
            'fee_structure',
            'fee_breakdown',
            'total_fees',
            'amount_paid',
            'due_amount',
            'due_date',
            'status',
            'last_payment_date',
            'overdue',
            'payments',
        ]

    def get_class_display(self, obj):
        cs = obj.student.class_section
        if not cs:
            return 'N/A'
        return f"{cs.class_ref.name} - {cs.section_ref.name}"

    def get_fee_breakdown(self, obj):
        fs = obj.fee_structure
        return {
            'tuition_fees': str(fs.tuition_fees),
            'exam_fees': str(fs.exam_fees),
            'other_charges': str(fs.other_charges),
        }

    def get_overdue(self, obj):
        from django.utils import timezone

        if obj.status == 'paid':
            return False
        return obj.due_date < timezone.now().date()


class StudentFeeListSerializer(serializers.ModelSerializer):
    """Lighter list rows (no nested payments)."""

    total_fees = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    due_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    student_name = serializers.CharField(source='student.user.name', read_only=True)
    admission_number = serializers.CharField(source='student.admission_number', read_only=True)
    class_display = serializers.SerializerMethodField()
    overdue = serializers.SerializerMethodField()

    def get_total_fees(self, obj):
        return str(obj.fee_structure.total_fees)

    def get_due_amount(self, obj):
        return str(obj.due_amount)

    class Meta:
        model = StudentFee
        fields = [
            'id',
            'student',
            'student_name',
            'admission_number',
            'class_display',
            'fee_structure',
            'total_fees',
            'amount_paid',
            'due_amount',
            'due_date',
            'status',
            'last_payment_date',
            'overdue',
        ]

    def get_class_display(self, obj):
        cs = obj.student.class_section
        if not cs:
            return 'N/A'
        return f"{cs.class_ref.name} - {cs.section_ref.name}"

    def get_overdue(self, obj):
        from django.utils import timezone

        if obj.status == 'paid':
            return False
        return obj.due_date < timezone.now().date()
