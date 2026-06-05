from django.contrib import admin

from .models import Syllabus


@admin.register(Syllabus)
class SyllabusAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'class_ref', 'subject', 'uploaded_by', 'uploaded_at')
    search_fields = ('title', 'class_ref__name', 'subject__name', 'uploaded_by__user__name', 'uploaded_by__user__username')
    list_filter = ('class_ref', 'subject', 'uploaded_at')

