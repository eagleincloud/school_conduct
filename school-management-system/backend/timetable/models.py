from django.db import models
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from datetime import time

User = get_user_model()

class Shift(models.Model):
    school = models.ForeignKey('tenants.School', on_delete=models.CASCADE, null=True, blank=True, related_name='shifts')
    name = models.CharField(max_length=50)
    start_time = models.TimeField()
    end_time = models.TimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('school', 'name')

    def __str__(self):
        return f"{self.name} ({self.start_time.strftime('%I:%M %p')} - {self.end_time.strftime('%I:%M %p')})"

class TimeTableEntry(models.Model):
    DAY_CHOICES = (
        (1, 'Monday'),
        (2, 'Tuesday'),
        (3, 'Wednesday'),
        (4, 'Thursday'),
        (5, 'Friday'),
        (6, 'Saturday'),
    )
    SHIFT_MORNING = 'morning'
    SHIFT_AFTERNOON = 'afternoon'
    SHIFT_CHOICES = (
        (SHIFT_MORNING, 'Morning Shift'),
        (SHIFT_AFTERNOON, 'Afternoon Shift'),
    )

    school = models.ForeignKey('tenants.School', on_delete=models.CASCADE, null=True, blank=True, related_name='timetable')
    class_name = models.CharField(max_length=50)
    section = models.CharField(max_length=50)
    subject = models.CharField(max_length=100)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='timetable_entries')
    day = models.IntegerField(choices=DAY_CHOICES)
    # Kept for backward compatibility with existing API payloads.
    period = models.IntegerField(default=1, null=True, blank=True)
    shift = models.CharField(max_length=20, choices=SHIFT_CHOICES, default=SHIFT_MORNING)
    shift_ref = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='entries', null=True, blank=True)
    period_number = models.IntegerField(default=1)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['shift_ref', 'day', 'period_number']
        unique_together = [
            ('school', 'class_name', 'section', 'shift_ref', 'day', 'period_number'),
            ('school', 'teacher', 'shift_ref', 'day', 'period_number'),
        ]
        indexes = [
            models.Index(fields=['teacher', 'day']),
            models.Index(fields=['class_name', 'section', 'day']),
        ]

    def clean(self):
        max_p = 6
        if self.period_number < 1 or self.period_number > max_p:
            raise ValidationError(f"Period number must be between 1 and {max_p}.")

    def save(self, *args, **kwargs):
        # Only auto-set if times are not provided or set to 00:00:00 (default)
        # 6 lectures per shift: 3 before break + 3 after break.
        if self.start_time == time(0, 0) and self.end_time == time(0, 0):
            morning_map = {
                1: (time(8, 0), time(8, 30)),
                2: (time(8, 30), time(9, 0)),
                3: (time(9, 0), time(9, 30)),
                4: (time(10, 0), time(10, 30)),
                5: (time(10, 30), time(11, 0)),
                6: (time(11, 0), time(11, 30)),
            }
            afternoon_map = {
                1: (time(13, 0), time(13, 30)),
                2: (time(13, 30), time(14, 0)),
                3: (time(14, 0), time(14, 30)),
                4: (time(15, 0), time(15, 30)),
                5: (time(15, 30), time(16, 0)),
                6: (time(16, 0), time(16, 30)),
            }
            time_map = morning_map if self.shift == self.SHIFT_MORNING else afternoon_map
            if getattr(self, 'period_number', None) in time_map:
                self.start_time, self.end_time = time_map[self.period_number]
                self.period = self.period_number
        
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.class_name}-{self.section} | {self.subject} | Day {self.day} Period {self.period}"
