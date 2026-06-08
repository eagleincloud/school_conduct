import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Display name on fee receipts and reports
SCHOOL_NAME = os.getenv('SCHOOL_NAME', 'School Management System')

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-default-key')
DEVICE_SECRET_KEY = os.getenv('DEVICE_SECRET_KEY', 'y0ur_Sup3r_S3cr3t_B1om3tr1c_K3y_987')
DEBUG = os.getenv('DEBUG', 'False') == 'True'
raw_hosts = os.getenv('ALLOWED_HOSTS', '*')
if raw_hosts:
    # Clean brackets and quotes in case they were written as a list string in .env
    clean_hosts = raw_hosts.replace('[', '').replace(']', '').replace("'", "").replace('"', '')
    ALLOWED_HOSTS = [h.strip() for h in clean_hosts.split(',') if h.strip()]
else:
    ALLOWED_HOSTS = ['.onrender.com', 'localhost', '127.0.0.1']

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

# Required for Render to correctly detect HTTPS behind proxy
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

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://school-management-system-1-ucmf.onrender.com",
    "https://school-management-system-36wrqw719.vercel.app",
    "http://54.183.203.190",
    "http://ec2-54-183-203-190.us-west-1.compute.amazonaws.com",
    "http://13.233.140.195",
    "http://ec2-13-233-140-195.ap-south-1.compute.amazonaws.com",
]

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
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
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
DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'




# CSRF Trusted Origins for Render
CSRF_TRUSTED_ORIGINS = [
    "https://school-management-system-l12n.onrender.com",
    "https://school-management-system-1-ucmf.onrender.com",
    "http://54.183.203.190",
    "http://ec2-54-183-203-190.us-west-1.compute.amazonaws.com",
    "http://13.233.140.195",
    "http://ec2-13-233-140-195.ap-south-1.compute.amazonaws.com",
]
for host in ALLOWED_HOSTS:
    if host and host != '*' and host != '.onrender.com':
        if not host.startswith('http'):
            CSRF_TRUSTED_ORIGINS.append(f"https://{host}")
        else:
            CSRF_TRUSTED_ORIGINS.append(host)

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
