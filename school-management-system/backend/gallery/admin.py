from django.contrib import admin

from .models import GalleryImage


@admin.register(GalleryImage)
class GalleryImageAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'uploaded_by', 'created_at')
    search_fields = ('title', 'uploaded_by__username', 'uploaded_by__email')
    ordering = ('-created_at',)

