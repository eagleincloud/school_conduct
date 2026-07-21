import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

print("Listing all users:")
for u in User.objects.all():
    print(f"ID: {u.id}, Username: {u.username}, Email: {u.email}, Role: {u.role}, IsActive: {u.is_active}, School: {u.school}")
