from django.contrib import admin

from .models import Announcement


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ['title', 'type', 'target_audience', 'start_date', 'end_date', 'school', 'is_pinned', 'created_at']
    list_filter = ['type', 'target_audience', 'is_important', 'is_pinned']
    search_fields = ['title', 'description']
