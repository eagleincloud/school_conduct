import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from config.urls import CustomTokenObtainPairView
from rest_framework.test import APIRequestFactory

User = get_user_model()
factory = APIRequestFactory()

# 1. Ensure password is set to admin123
u = User.objects.get(username='shiv')
u.set_password('admin123')
u.save()
print("Password set to 'admin123' for user 'shiv'.")

# 2. Simulate login request
view = CustomTokenObtainPairView.as_view()
req = factory.post('/api/auth/login/', {'username': 'shiv', 'password': 'admin123'}, format='json')
res = view(req)

print("\nLOGIN STATUS CODE:", res.status_code)
print("LOGIN RESPONSE DATA:", res.data if hasattr(res, 'data') else res.content)
