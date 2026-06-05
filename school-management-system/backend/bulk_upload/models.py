from django.db import models
from django.conf import settings

class BulkImportLog(models.Model):
    IMPORT_TYPE_CHOICES = (
        ('student', 'Student'),
        ('teacher', 'Teacher'),
    )

    file_name = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    school = models.ForeignKey('tenants.School', on_delete=models.CASCADE)
    import_type = models.CharField(max_length=20, choices=IMPORT_TYPE_CHOICES)
    total_rows = models.IntegerField(default=0)
    success_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    imported_users = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='import_logs', blank=True)

    def __str__(self):
        return f"{self.import_type} import via {self.file_name} on {self.created_at}"
