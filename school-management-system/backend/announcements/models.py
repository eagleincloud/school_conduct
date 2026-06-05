from django.conf import settings
from django.db import models
from django.utils import timezone


class Announcement(models.Model):
    TYPE_HOLIDAY = 'holiday'
    TYPE_EXAM = 'exam'
    TYPE_GENERAL = 'general'
    TYPE_CHOICES = (
        (TYPE_HOLIDAY, 'Holiday'),
        (TYPE_EXAM, 'Exam'),
        (TYPE_GENERAL, 'General'),
    )

    AUDIENCE_ALL = 'all'
    AUDIENCE_STUDENTS = 'students'
    AUDIENCE_TEACHERS = 'teachers'
    AUDIENCE_CHOICES = (
        (AUDIENCE_ALL, 'All'),
        (AUDIENCE_STUDENTS, 'Students'),
        (AUDIENCE_TEACHERS, 'Teachers'),
    )

    school = models.ForeignKey(
        'tenants.School',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='announcements',
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_HOLIDAY)
    start_date = models.DateField()
    end_date = models.DateField()
    target_audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES, default=AUDIENCE_ALL)
    class_ref = models.ForeignKey(
        'classes.MainClass',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='announcements',
    )
    attachment = models.FileField(upload_to='announcements/%Y/%m/', blank=True, null=True)
    is_important = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='announcements_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-is_important', '-created_at']

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if self.end_date and self.start_date and self.end_date < self.start_date:
            self.end_date = self.start_date
        super().save(*args, **kwargs)

    @property
    def is_active(self) -> bool:
        today = timezone.localdate()
        return self.end_date >= today

    @property
    def is_holiday_window(self) -> bool:
        if self.type != self.TYPE_HOLIDAY:
            return False
        today = timezone.localdate()
        return self.start_date <= today <= self.end_date
