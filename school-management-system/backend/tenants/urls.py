from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SchoolDetailView,
    CommonSchoolInfoView, 
    SuperadminSchoolViewSet, 
    BulkIDCardGenerationView
)

router = DefaultRouter()
# Admin endpoints for managing schools
router.register(r'admin-schools', SuperadminSchoolViewSet, basename='admin-schools')

urlpatterns = [
    # Router URLs MUST be before the dynamic <str:name> route to prevent shadowing
    path('', include(router.urls)),

    # Public route to get specific tenant details (e.g. /api/schools/sc-01/)
    path('<str:name>/', SchoolDetailView.as_view(), name='school-detail'),
    
    # Authenticated common info
    path('common/info/', CommonSchoolInfoView.as_view(), name='common-school-info'),
    
    # Superadmin tools
    path('tools/bulk-id-cards/', BulkIDCardGenerationView.as_view(), name='bulk-id-cards'),
]
