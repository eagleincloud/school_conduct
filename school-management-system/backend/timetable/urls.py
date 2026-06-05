from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TimeTableViewSet, ShiftViewSet

router = DefaultRouter()
router.register(r'shifts', ShiftViewSet, basename='shifts')
router.register(r'', TimeTableViewSet, basename='timetable')

urlpatterns = [
    path('', include(router.urls)),
]
