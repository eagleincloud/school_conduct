from django.contrib import admin

from .models import Holiday


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'start_date', 'end_date', 'type']
    list_filter = ['type', 'start_date']
    search_fields = ['title', 'description']

