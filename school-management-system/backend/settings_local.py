"""
Local development settings - uses SQLite and skips external services
"""
from .settings import *

# Use SQLite for local development (no external DB needed)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Disable Cloudinary for local dev (no credentials needed)
DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Allow all origins for local dev
CORS_ALLOW_ALL_ORIGINS = True

# Security settings relaxed for local dev
DEBUG = True
SECRET_KEY = 'local-dev-insecure-key-change-in-production'
ALLOWED_HOSTS = ['*']
