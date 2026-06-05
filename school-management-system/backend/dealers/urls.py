from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DealerViewSet, DealerSchoolViewSet, DealerProfileViewSet

router = DefaultRouter()
router.register(r'management', DealerViewSet, basename='dealer-management')
router.register(r'schools', DealerSchoolViewSet, basename='dealer-schools')
router.register(r'profile', DealerProfileViewSet, basename='dealer-profile')


urlpatterns = [
    path('', include(router.urls)),
]
