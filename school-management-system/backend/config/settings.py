import os
import re
import codecs
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

load_dotenv(override=False)

BASE_DIR = Path(__file__).resolve().parent.parent

# Display name on fee receipts and reports
SCHOOL_NAME = os.getenv('SCHOOL_NAME', 'School Management System')

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-default-key')
DEBUG = os.getenv('DEBUG', 'False').strip().lower() == 'true'
if not DEBUG and SECRET_KEY == 'django-insecure-default-key':
    raise ImproperlyConfigured('Set a strong SECRET_KEY before running in production.')
USE_POSTGRES = os.getenv('USE_POSTGRES', 'False').strip().lower() == 'true'
PUBLIC_API_BASE_URL = os.getenv('PUBLIC_API_BASE_URL', 'http://127.0.0.1:8000').rstrip('/')
BIOMETRIC_TCP_HOST = os.getenv('BIOMETRIC_TCP_HOST', '0.0.0.0')
BIOMETRIC_TCP_PORT = int(os.getenv('BIOMETRIC_TCP_PORT', '5555'))
BIOMETRIC_TCP_SOCKET_TIMEOUT = int(os.getenv('BIOMETRIC_TCP_SOCKET_TIMEOUT', '15'))
BIOMETRIC_TCP_MAX_PAYLOAD_BYTES = int(os.getenv('BIOMETRIC_TCP_MAX_PAYLOAD_BYTES', '65536'))
BIOMETRIC_TCP_ACK_MESSAGE = codecs.decode(os.getenv('BIOMETRIC_TCP_ACK_MESSAGE', 'OK\\r\\n'), 'unicode_escape')
BIOMETRIC_SBXPC_ACK_MESSAGE = codecs.decode(
    os.getenv(
        'BIOMETRIC_SBXPC_ACK_MESSAGE',
        '<?xml version="1.0"?><Message><Request>UploadedLog</Request>'
        '<TransID>{TransID}</TransID></Message>',
    ),
    'unicode_escape',
)
BIOMETRIC_SBXPC_ACK_TEMPLATE = codecs.decode(
    os.getenv('BIOMETRIC_SBXPC_ACK_TEMPLATE', ''),
    'unicode_escape',
)
BIOMETRIC_SBXPC_ACK_MODE = os.getenv(
    'ACK_MODE',
    os.getenv('BIOMETRIC_SBXPC_ACK_MODE', 'NUL'),
).strip().upper()
BIOMETRIC_SBXPC_CLOSE_AFTER_ACK = (
    os.getenv('BIOMETRIC_SBXPC_CLOSE_AFTER_ACK', 'False').strip().lower() == 'true'
)
BIOMETRIC_SBXPC_IDLE_TIMEOUT_SECONDS = int(
    os.getenv('BIOMETRIC_SBXPC_IDLE_TIMEOUT_SECONDS', '86400')
)
BIOMETRIC_TCP_DIAGNOSTIC_PREVIEW_BYTES = int(
    os.getenv('BIOMETRIC_TCP_DIAGNOSTIC_PREVIEW_BYTES', '512')
)
BIOMETRIC_PROTOCOL_DIAGNOSTICS_ENABLED = (
    os.getenv('BIOMETRIC_PROTOCOL_DIAGNOSTICS_ENABLED', 'False').strip().lower() == 'true'
)
BIOMETRIC_TCP_CLOSE_AFTER_ACK = os.getenv('BIOMETRIC_TCP_CLOSE_AFTER_ACK', 'False').strip().lower() == 'true'
raw_hosts = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1')
if raw_hosts:
    # Clean brackets and quotes in case they were written as a list string in .env
    clean_hosts = raw_hosts.replace('[', '').replace(']', '').replace("'", "").replace('"', '')
    # Remove any scheme (http:// or https://) that may have been included by mistake
    clean_hosts = re.sub(r'https?://', '', clean_hosts)
    # Split and strip whitespace and trailing slashes from each host
    ALLOWED_HOSTS = [h.strip().rstrip('/') for h in clean_hosts.split(',') if h.strip()]
else:
    ALLOWED_HOSTS = ['localhost', '127.0.0.1']

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Cloudinary Integration
    'cloudinary_storage',
    'cloudinary',

    # Third Party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
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
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Required to correctly detect HTTPS behind reverse proxy (Nginx)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')


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
        'core.authentication.ActiveTenantJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': int(os.getenv('API_PAGE_SIZE', '50')),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': os.getenv('API_ANON_RATE', '300/minute'),
        'user': os.getenv('API_USER_RATE', '600/minute'),
        'login': os.getenv('API_LOGIN_RATE', '5/minute'),
        'token_refresh': os.getenv('API_TOKEN_REFRESH_RATE', '30/minute'),
        'upload': os.getenv('API_UPLOAD_RATE', '10/minute'),
        'report': os.getenv('API_REPORT_RATE', '10/minute'),
        'enquiry': os.getenv('API_ENQUIRY_RATE', '5/hour'),
    },
}

API_DEFAULT_PAGE_SIZE = int(os.getenv('API_PAGE_SIZE', '50'))
API_MAX_BULK_ROWS = int(os.getenv('API_MAX_BULK_ROWS', '1000'))
API_MAX_EXPORT_ROWS = int(os.getenv('API_MAX_EXPORT_ROWS', '10000'))
API_MAX_UPLOAD_BYTES = int(os.getenv('API_MAX_UPLOAD_BYTES', str(10 * 1024 * 1024)))
GALLERY_SIGNED_URL_TTL_SECONDS = int(os.getenv('GALLERY_SIGNED_URL_TTL_SECONDS', '300'))
DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv('DATA_UPLOAD_MAX_MEMORY_SIZE', str(12 * 1024 * 1024)))
FILE_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv('FILE_UPLOAD_MAX_MEMORY_SIZE', str(5 * 1024 * 1024)))

if DEBUG and not USE_POSTGRES:
    # Use lightweight SQLite for local development only when Postgres is not explicitly requested.
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME', 'postgres'),
            'USER': os.getenv('DB_USER', 'postgres'),
            'PASSWORD': os.getenv('DB_PASSWORD', ''),
            'HOST': os.getenv('DB_HOST', 'localhost'),
            'PORT': os.getenv('DB_PORT', '5432'),
            'OPTIONS': {
                'sslmode': 'require',
                'connect_timeout': 10,
            },
            'CONN_MAX_AGE': int(os.getenv('DB_CONN_MAX_AGE', '60')),
            'CONN_HEALTH_CHECKS': True,
        },
    }

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=int(os.getenv('JWT_ACCESS_MINUTES', '15'))),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=int(os.getenv('JWT_REFRESH_DAYS', '7'))),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': os.getenv('JWT_SIGNING_KEY', SECRET_KEY),
    'AUTH_HEADER_TYPES': ('Bearer',),
    'CHECK_REVOKE_TOKEN': True,
}

CORS_ALLOW_CREDENTIALS = os.getenv('CORS_ALLOW_CREDENTIALS', 'False').strip().lower() == 'true'
CORS_ALLOWED_ORIGINS = [
    origin.strip().rstrip('/')
    for origin in os.getenv('CORS_ALLOWED_ORIGINS', '').split(',')
    if origin.strip()
]
if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES = [r"^http://localhost:\d+$", r"^http://127\.0\.0\.1:\d+$"]

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 10}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ============================================================
# CLOUDINARY CONFIGURATION
# ============================================================
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': os.getenv('CLOUDINARY_CLOUD_NAME'),
    'API_KEY': os.getenv('CLOUDINARY_API_KEY'),
    'API_SECRET': os.getenv('CLOUDINARY_API_SECRET'),
}
STORAGES = {
    'default': {
        'BACKEND': 'cloudinary_storage.storage.MediaCloudinaryStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}




# CSRF Trusted Origins
CSRF_TRUSTED_ORIGINS = [
    origin.strip().rstrip('/')
    for origin in os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',')
    if origin.strip()
]

# Only automatically append host-derived https entries in non-debug (production)
# to avoid adding https://localhost during local development.
if not DEBUG:
    for host in ALLOWED_HOSTS:
        if host and host != '*':
            if not host.startswith('http'):
                CSRF_TRUSTED_ORIGINS.append(f"https://{host}")
            else:
                CSRF_TRUSTED_ORIGINS.append(host)

SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', str(not DEBUG)).strip().lower() == 'true'
SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', str(not DEBUG)).strip().lower() == 'true'
CSRF_COOKIE_SECURE = os.getenv('CSRF_COOKIE_SECURE', str(not DEBUG)).strip().lower() == 'true'
SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '31536000' if not DEBUG else '0'))
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
X_FRAME_OPTIONS = 'DENY'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = True

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
