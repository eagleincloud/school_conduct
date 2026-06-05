from django.db import models
from django.utils import timezone
from django.conf import settings


class Exam(models.Model):
    EXAM_TYPES = (
        ('unit_test', 'Unit Test'),
        ('class_test', 'Class Test'),
        ('mst', 'MST'),
        ('final', 'Final'),
    )
    STATUS_CHOICES = (
        ('Draft', 'Draft'),
        ('Published', 'Published'),
    )

    name = models.CharField(max_length=150)
    class_section = models.ForeignKey('classes.ClassSection', on_delete=models.CASCADE, related_name='exams')
    exam_type = models.CharField(max_length=30, choices=EXAM_TYPES, default='unit_test')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    total_marks = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    passing_marks = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Draft')
    description = models.TextField(blank=True, null=True)
    date = models.DateField()
    result_published = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.name} - {self.class_section}"

    def save(self, *args, **kwargs):
        if self.start_date and not self.date:
            self.date = self.start_date
        if self.start_date and self.end_date and self.end_date < self.start_date:
            self.end_date = self.start_date
        if self.date and not self.start_date:
            self.start_date = self.date
        if not self.end_date and self.start_date:
            self.end_date = self.start_date
        super().save(*args, **kwargs)


class ExamSchedule(models.Model):
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='schedules')
    subject = models.CharField(max_length=120)
    exam_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        ordering = ['exam_date', 'start_time']
        unique_together = ('exam', 'subject')

    def __str__(self):
        return f"{self.exam.name} - {self.subject}"

class Result(models.Model):
    student = models.ForeignKey('students.StudentProfile', on_delete=models.CASCADE, related_name='results')
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='student_results')
    subject = models.CharField(max_length=100)
    marks = models.DecimalField(max_digits=7, decimal_places=2, blank=True, null=True)
    max_marks = models.DecimalField(max_digits=5, decimal_places=2)
    absent = models.BooleanField(default=False)

    class Meta:
        unique_together = ('student', 'exam', 'subject')

    def __str__(self):
        return f"{self.student.user.username} - {self.exam.name} ({self.subject})"


class Marks(models.Model):
    EXAM_TYPE_CHOICES = [
        ('unit_test', 'Unit Test'),
        ('class_test', 'Class Test'),
        ('mst', 'MST'),
        ('final', 'Final'),
    ]
    student = models.ForeignKey('students.StudentProfile', on_delete=models.CASCADE, related_name='marks_entries')
    subject = models.ForeignKey('subjects.Subject', on_delete=models.CASCADE, related_name='marks_entries')
    class_section = models.ForeignKey('classes.ClassSection', on_delete=models.CASCADE, related_name='marks_entries')
    exam_type = models.CharField(max_length=30, choices=EXAM_TYPE_CHOICES)
    marks = models.FloatField()
    max_marks = models.FloatField(default=100.0)
    is_uploaded = models.BooleanField(default=False)
    is_locked = models.BooleanField(default=False)
    uploaded_by = models.ForeignKey('teachers.TeacherProfile', on_delete=models.SET_NULL, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('student', 'subject', 'exam_type')

    def __str__(self):
        return f"{self.student.user.username} - {self.subject.name} ({self.exam_type})"


class ResultStatus(models.Model):
    EXAM_TYPE_CHOICES = [
        ('unit_test', 'Unit Test'),
        ('class_test', 'Class Test'),
        ('mst', 'MST'),
        ('final', 'Final'),
    ]
    class_section = models.ForeignKey('classes.ClassSection', on_delete=models.CASCADE, related_name='result_statuses')
    exam_type = models.CharField(max_length=30, choices=EXAM_TYPE_CHOICES)
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        unique_together = ('class_section', 'exam_type')

    def __str__(self):
        return f"{self.class_section} - {self.exam_type} ({'Published' if self.is_published else 'Draft'})"
