import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Display name on fee receipts and reports
SCHOOL_NAME = os.getenv('SCHOOL_NAME', 'School Management System')

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-default-key')
DEBUG = os.getenv('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1, '*'').split(',')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third Party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    # Local Apps (modular)
    'dealers',
    'accounts',
    'students',
    'teachers',
    'classes',
    'attendance',
    'academics',
    'assignments',
    'communication',
    'fees',
    'timetable',
    'subjects',
    'holidays',
    'tenants',
    'syllabus',
    'bulk_upload',
    'announcements',
    'leaves',
    'gallery',
    'reports',
    'shops',
    'enquiries',
]


MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'



# Authentication
AUTH_USER_MODEL = 'accounts.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'postgres'),
        'USER': os.getenv('DB_USER', 'postgres.uzztcarhwpsrjhaxqgiu'),
        'PASSWORD': os.getenv('DB_PASSWORD', 'quZz5KvCpSKSO5lJ'),
        'HOST': os.getenv('DB_HOST', 'aws-1-ap-south-1.pooler.supabase.com'),
        'PORT': os.getenv('DB_PORT', '6543'),
        'OPTIONS': {
            'sslmode': 'require',
        },
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

CORS_ALLOW_ALL_ORIGINS = True # Change in production

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'




DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'postgres'),
        'USER': os.getenv('DB_USER', 'postgres.uzztcarhwpsrjhaxqgiu'),
        'PASSWORD': os.getenv('DB_PASSWORD', 'quZz5KvCpSKSO5lJ'),
        'HOST': os.getenv('DB_HOST', 'aws-1-ap-south-1.pooler.supabase.com'),
        'PORT': os.getenv('DB_PORT', '6543'),
        'OPTIONS': {
            'sslmode': 'require',
        },
    }
}

# ============================================================
# EMAIL CONFIGURATION
# ============================================================
# STEP 1: Replace 'your-email@gmail.com' with your official Gmail address
#         (e.g., 'schoolconduct.official@gmail.com')
#
# STEP 2: Replace 'your-app-password' with a Gmail App Password.
#         ⚠️  This is NOT your Gmail login password!
#         To generate an App Password:
#           1. Go to https://myaccount.google.com/apppasswords
#           2. Sign in → Select app "Mail" → Select device "Other"
#           3. Click "Generate" → Copy the 16-character password
#           4. Paste it below in EMAIL_HOST_PASSWORD
#
# STEP 3: Replace 'admin-email@gmail.com' in CONTACT_EMAIL with the
#         official email where you want to RECEIVE all enquiry notifications.
# ============================================================

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', 'your-email@gmail.com')          # ← SENDER email (your Gmail)
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', 'your-app-password')      # ← Gmail App Password (16 chars)

DEFAULT_FROM_EMAIL = EMAIL_HOST_USER
CONTACT_EMAIL = os.getenv('CONTACT_EMAIL', 'admin-email@gmail.com')              # ← RECEIVER email (enquiries go here)
