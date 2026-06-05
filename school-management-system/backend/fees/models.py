from datetime import date
from decimal import Decimal

from django.db import models
from django.db.models import Sum
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver


class ClassFeeCard(models.Model):
    class_name = models.CharField(max_length=50)
    registration_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    admission_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    tuition_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    computer_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    annual_charges = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    science_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    sports_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    total_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_fee_cards',
    )
    school = models.ForeignKey(
        'tenants.School',
        on_delete=models.CASCADE,
        related_name='fee_cards',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['class_name']
        unique_together = ('school', 'class_name')

    def __str__(self):
        return f"{self.class_name} — ₹{self.total_fee}"

    def save(self, *args, **kwargs):
        self.total_fee = (
            (self.registration_fee or Decimal('0'))
            + (self.admission_fee or Decimal('0'))
            + (self.tuition_fee or Decimal('0'))
            + (self.computer_fee or Decimal('0'))
            + (self.annual_charges or Decimal('0'))
            + (self.science_fee or Decimal('0'))
            + (self.sports_fee or Decimal('0'))
        )
        super().save(*args, **kwargs)


class ClassFeeCardRollback(models.Model):
    school = models.ForeignKey(
        'tenants.School',
        on_delete=models.CASCADE,
        related_name='fee_card_rollbacks',
    )
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fee_card_rollbacks',
    )
    source = models.CharField(max_length=50, default='manual')
    snapshot = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.school_id} rollback @ {self.created_at}"


class FeeStructure(models.Model):
    """Class-wise fee definition (one active structure per class)."""

    class_ref = models.OneToOneField(
        'classes.MainClass',
        on_delete=models.CASCADE,
        related_name='fee_structure',
    )
    tuition_fees = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    exam_fees = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    other_charges = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    total_fees = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    due_date = models.DateField(default=date.today)
    # Legacy columns present in production DB schema; keep defaults
    # so insert operations do not fail with NOT NULL constraint errors.
    registration_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    admission_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    tuition_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    computer_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    annual_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    science_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    sports_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    description = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ['class_ref__name']

    def __str__(self):
        return f"{self.class_ref.name} — ₹{self.total_fees}"

    def save(self, *args, **kwargs):
        self.total_fees = (
            (self.tuition_fees or Decimal('0'))
            + (self.exam_fees or Decimal('0'))
            + (self.other_charges or Decimal('0'))
        )
        super().save(*args, **kwargs)


class StudentFee(models.Model):
    STATUS_CHOICES = (
        ('paid', 'Paid'),
        ('pending', 'Pending'),
        ('partial', 'Partial'),
    )

    student = models.ForeignKey(
        'students.StudentProfile',
        on_delete=models.CASCADE,
        related_name='fees',
    )
    fee_structure = models.ForeignKey(
        FeeStructure,
        on_delete=models.CASCADE,
        related_name='student_fees',
    )
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    due_date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    last_payment_date = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ('student', 'fee_structure')
        ordering = ['-id']

    def __str__(self):
        return f"{self.student.user.username} — {self.status}"

    @property
    def total_fees(self):
        return self.fee_structure.total_fees

    @property
    def due_amount(self):
        return max(self.total_fees - self.amount_paid, Decimal('0.00'))


class Payment(models.Model):
    PAYMENT_MODE_CHOICES = (
        ('Cash', 'Cash'),
        ('UPI', 'UPI'),
        ('Card', 'Card'),
        ('Bank Transfer', 'Bank Transfer'),
        ('Cheque', 'Cheque'),
        ('Other', 'Other'),
    )

    student_fee = models.ForeignKey(
        StudentFee,
        on_delete=models.CASCADE,
        related_name='payments',
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField()
    payment_mode = models.CharField(max_length=32, choices=PAYMENT_MODE_CHOICES, default='Cash')
    transaction_id = models.CharField(max_length=128, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-payment_date', '-created_at']

    def __str__(self):
        return f"₹{self.amount} on {self.payment_date}"


def recalculate_student_fee(student_fee: StudentFee) -> None:
    """Set amount_paid and status from linked payments."""
    total_paid = student_fee.payments.aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
    student_fee.amount_paid = total_paid
    cap = student_fee.fee_structure.total_fees
    last = student_fee.payments.order_by('-payment_date', '-created_at').first()
    student_fee.last_payment_date = last.payment_date if last else None

    if total_paid >= cap:
        student_fee.status = 'paid'
    elif total_paid > 0:
        student_fee.status = 'partial'
    else:
        student_fee.status = 'pending'
    StudentFee.objects.filter(pk=student_fee.pk).update(
        amount_paid=student_fee.amount_paid,
        status=student_fee.status,
        last_payment_date=student_fee.last_payment_date,
    )


@receiver(post_save, sender=Payment)
def payment_saved_recalc(sender, instance, **kwargs):
    recalculate_student_fee(instance.student_fee)


@receiver(post_delete, sender=Payment)
def payment_deleted_recalc(sender, instance, **kwargs):
    try:
        sf = StudentFee.objects.get(pk=instance.student_fee_id)
        recalculate_student_fee(sf)
    except StudentFee.DoesNotExist:
        pass
