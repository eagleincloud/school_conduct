from django.urls import path
from .views import (
    ChangePasswordView,
    FirstLoginResetPasswordView,
    LogoutView,
    UpdateProfileView,
    UserCreateView,
    UserProfileView,
)

urlpatterns = [
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('update-profile/', UpdateProfileView.as_view(), name='update-profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('reset-password-first-login/', FirstLoginResetPasswordView.as_view(), name='reset-password-first-login'),
    path('logout/', LogoutView.as_view(), name='logout'),

    path('admin/create-user/', UserCreateView.as_view(), name='admin-create-user'),
]
