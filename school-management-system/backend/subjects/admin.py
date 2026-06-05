from django.contrib import admin

from .models import Subject, SubjectNote, SubjectAssignment, TeacherAssignment


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ['id', 'class_ref', 'name', 'code', 'status', 'created_at']
    list_filter = ['class_ref', 'status']
    search_fields = ['name', 'code']


@admin.register(SubjectNote)
class SubjectNoteAdmin(admin.ModelAdmin):
    list_display = ['id', 'subject', 'title', 'created_at']
    search_fields = ['title']


@admin.register(SubjectAssignment)
class SubjectAssignmentAdmin(admin.ModelAdmin):
    list_display = ['id', 'subject', 'title', 'due_date', 'created_at']
    list_filter = ['due_date']
    search_fields = ['title']


@admin.register(TeacherAssignment)
class TeacherAssignmentAdmin(admin.ModelAdmin):
    list_display = ['id', 'teacher', 'class_ref', 'subject', 'created_at']
    list_filter = ['class_ref', 'subject']
    search_fields = ['teacher__user__name', 'teacher__employee_id', 'subject__name', 'class_ref__name']

