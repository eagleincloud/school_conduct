from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class ActiveTenantJWTAuthentication(JWTAuthentication):
    """Reject JWT access when a school account is missing or suspended."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, token = result
        is_platform_user = user.is_superuser or user.role in {'superadmin', 'dealer'}
        if not is_platform_user:
            if user.school_id is None:
                raise AuthenticationFailed('User is not assigned to a school.')
            if not user.school.is_active:
                raise AuthenticationFailed('School account is suspended.')
        return user, token
