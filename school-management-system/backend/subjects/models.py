from django.db import models


class Subject(models.Model):
    STATUS_CHOICES = (
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
    )

    school = models.ForeignKey('tenants.School', on_delete=models.CASCADE, null=True, blank=True, related_name='subjects')
    class_ref = models.ForeignKey('classes.MainClass', on_delete=models.CASCADE, related_name='subjects')
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    teachers = models.ManyToManyField('teachers.TeacherProfile', related_name='subjects', blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Active')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('class_ref', 'name')
        ordering = ['class_ref__name', 'name']

    def __str__(self) -> str:
        return f"{self.class_ref.name}: {self.name}"


class SubjectNote(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='notes')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    # Supports PDF/DOC uploads via base64 decoding in API.
    file = models.FileField(upload_to='subject_notes/', blank=True, null=True)
    link_url = models.URLField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.title


class SubjectAssignment(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='assignments')
    title = models.CharField(max_length=255)
    due_date = models.DateField()

    # Supports file upload via base64 decoding in API.
    file = models.FileField(upload_to='subject_assignments/', blank=True, null=True)
    created_by = models.ForeignKey(
        'teachers.TeacherProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subject_assignments',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['due_date', '-created_at']

    def __str__(self) -> str:
        return f"{self.title} ({self.due_date})"


class TeacherAssignment(models.Model):
    ROLE_CHOICES = [
        ('Class Teacher', 'Class Teacher'),
        ('Subject Teacher', 'Subject Teacher'),
    ]

    teacher = models.ForeignKey(
        'teachers.TeacherProfile',
        on_delete=models.CASCADE,
        related_name='teaching_assignments',
    )
    class_ref = models.ForeignKey(
        'classes.MainClass',
        on_delete=models.CASCADE,
        related_name='teacher_assignments',
    )
    section = models.ForeignKey(
        'classes.ClassSection',
        on_delete=models.CASCADE,
        related_name='teacher_assignments',
        null=True,
        blank=True,
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='teacher_assignments',
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='Subject Teacher'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('teacher', 'class_ref', 'section', 'subject', 'role')
        ordering = ['class_ref__name', 'subject__name', 'teacher__employee_id']

    def __str__(self) -> str:
        teacher_name = self.teacher.user.name or self.teacher.user.username
        if self.section:
            section_name = self.section.section_ref.name
            return f"{teacher_name} -> {self.class_ref.name} ({section_name}) / {self.subject.name}"
        return f"{teacher_name} -> {self.class_ref.name} / {self.subject.name}"

