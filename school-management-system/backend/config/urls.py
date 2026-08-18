from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.db import connection

from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.views import TokenObtainPairView
from accounts.serializers import CustomTokenObtainPairSerializer
from accounts.views import AdminDashboardStatsView
from tenants.views import SchoolDetailView

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_scope = 'login'


class CustomTokenRefreshView(TokenRefreshView):
    throttle_scope = 'token_refresh'

# --- Utility Views ---
def root_view(request):
    """Handles the root URL '/' and confirms the API is running."""
    return JsonResponse({
        "status": "online",
        "message": "School Management System Backend API is running.",
        "version": "1.0",
        "docs": "Ensure you are using /api/ for data endpoints."
    })

def health_check(request):
    """Health check endpoint for deployment verification."""
    try:
        connection.ensure_connection()
    except Exception:
        return JsonResponse({"status": "unhealthy", "database": "unavailable"}, status=503)
    response = JsonResponse({"status": "healthy", "database": "available"})
    response['Cache-Control'] = 'no-store'
    return response

def test_route(request):
    """Debug route to confirm server functionality."""
    return JsonResponse({
        "status": "success",
        "message": "Test route is working!",
    })


# Custom 404 handler to ensure all Not Found errors return JSON instead of Django's default HTML
handler404 = 'config.urls.custom_404'
def custom_404(request, exception=None):
    return JsonResponse({
        "error": "Not Found",
        "message": f"The requested URL {request.path} was not found on this server or the resource does not exist."
    }, status=404)

urlpatterns = [
    # Server Base URLs
    path('', root_view, name='root'),
    path('health/', health_check, name='health_check'),
    *([path('test/', test_route, name='test_route')] if settings.DEBUG else []),
    
    # Dynamic route for tenant/school access
    path('school/<str:name>/', SchoolDetailView.as_view(), name='direct-school-info'),

    path('admin/', admin.site.urls),
    
    # Auth
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),

    # Modular Apps URLs
    path('api/auth/', include('accounts.urls')),
    path('api/accounts/', include('accounts.urls')),
    path('api/schools/', include('tenants.urls')), # Kept clean, removed duplicate api/tenants/
    path('api/dealers/', include('dealers.urls')),
    path('api/students/', include('students.urls')),
    path('api/teachers/', include('teachers.urls')),
    path('api/classes/', include('classes.urls')),
    path('api/attendance/', include('attendance.urls')),
    path('api/academics/', include('academics.urls')),
    path('api/assignments/', include('assignments.urls')),
    path('api/communication/', include('communication.urls')),
    path('api/fees/', include('fees.urls')),
    path('api/timetable/', include('timetable.urls')),
    path('api/subjects/', include('subjects.urls')),
    path('api/holidays/', include('holidays.urls')),
    path('api/announcements/', include('announcements.urls')),
    path('api/gallery/', include('gallery.urls')),
    path('api/syllabus/', include('syllabus.urls')),
    path('api/bulk-upload/', include('bulk_upload.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/shops/', include('shops.urls')),
    path('api/enquiries/', include('enquiries.urls')),

    # Admin Dashboard stats
    path('api/admin/dashboard/stats', AdminDashboardStatsView.as_view(), name='admin-dashboard-stats'),
]

# Serve uploaded files in dev mode.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
