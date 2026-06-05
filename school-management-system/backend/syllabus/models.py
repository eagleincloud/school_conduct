from django.db import models


class Syllabus(models.Model):
    class_ref = models.ForeignKey(
        'classes.MainClass',
        on_delete=models.CASCADE,
        related_name='syllabi',
    )
    subject = models.ForeignKey(
        'subjects.Subject',
        on_delete=models.CASCADE,
        related_name='syllabi',
    )
    uploaded_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='uploaded_syllabi',
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    file = models.FileField(upload_to='syllabus_files/')

    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self) -> str:
        return f"{self.title} ({self.class_ref.name} - {self.subject.name})"

