from django.urls import path
from .views import UserCreateView, UserProfileView, ChangePasswordView, UpdateProfileView

urlpatterns = [
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('update-profile/', UpdateProfileView.as_view(), name='update-profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),

    path('admin/create-user/', UserCreateView.as_view(), name='admin-create-user'),
]
