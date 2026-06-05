from django.db import models

class MainClass(models.Model):
    school = models.ForeignKey('tenants.School', on_delete=models.CASCADE, null=True, blank=True, related_name='classes')
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=30, blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('school', 'name')

    def __str__(self):
        return self.name

class MainSection(models.Model):
    school = models.ForeignKey('tenants.School', on_delete=models.CASCADE, null=True, blank=True, related_name='sections')
    name = models.CharField(max_length=10)

    class Meta:
        unique_together = ('school', 'name')

    def __str__(self):
        return self.name

class ClassSection(models.Model):
    school = models.ForeignKey('tenants.School', on_delete=models.CASCADE, null=True, blank=True, related_name='class_sections')
    class_ref = models.ForeignKey(MainClass, on_delete=models.CASCADE, related_name='sections')
    section_ref = models.ForeignKey(MainSection, on_delete=models.CASCADE, related_name='classes')
    class_teacher = models.ForeignKey('teachers.TeacherProfile', on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_class')
    assigned_shift = models.ForeignKey('timetable.Shift', on_delete=models.SET_NULL, null=True, blank=True, related_name='sections')
    room_number = models.CharField(max_length=30, blank=True, null=True)

    class Meta:
        unique_together = ('class_ref', 'section_ref')

    def __str__(self):
        return f"{self.class_ref.name} - {self.section_ref.name}"
