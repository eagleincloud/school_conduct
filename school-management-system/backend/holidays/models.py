from django.db import models
from django.db.models import Q


class Holiday(models.Model):
    PUBLIC = 'Public'
    SCHOOL = 'School'
    OPTIONAL = 'Optional'

    TYPE_CHOICES = (
        (PUBLIC, 'Public'),
        (SCHOOL, 'School'),
        (OPTIONAL, 'Optional'),
    )

    school = models.ForeignKey('tenants.School', on_delete=models.CASCADE, null=True, blank=True, related_name='holidays')
    title = models.CharField(max_length=150)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=PUBLIC)

    # If empty => applicable for all classes.
    applicable_classes = models.ManyToManyField('classes.MainClass', blank=True, related_name='holidays')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['start_date', 'id']

    def __str__(self):
        return self.title

    @property
    def effective_end_date(self):
        return self.end_date or self.start_date

    @staticmethod
    def ranges_overlap(start_a, end_a, start_b, end_b) -> bool:
        return start_a <= end_b and end_a >= start_b

    @classmethod
    def has_overlapping_holiday(cls, *, start_date, end_date, exclude_id=None) -> bool:
        # Overlap check at DB level (fast enough for small datasets).
        end_date = end_date or start_date
        qs = cls.objects.all()
        if exclude_id:
            qs = qs.exclude(id=exclude_id)

        # (existing.start <= new.end) AND (coalesce(existing.end, existing.start) >= new.start)
        overlap = qs.filter(
            start_date__lte=end_date
        ).filter(
            Q(end_date__isnull=True, start_date__gte=start_date) |
            Q(end_date__isnull=False, end_date__gte=start_date)
        )
        return overlap.exists()

