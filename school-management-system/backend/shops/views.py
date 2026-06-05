from rest_framework import viewsets, permissions
from .models import Shop
from .serializers import ShopSerializer

class ShopViewSet(viewsets.ModelViewSet):
    serializer_class = ShopSerializer

    def get_queryset(self):
        # 🔒 Data Isolation: Only show shops belonging to the user's school.
        # Superadmins and Dealers retain global visibility if they have no school context.
        qs = Shop.objects.select_related('school').order_by('-created_at')
        user = self.request.user
        if not (user.is_superuser or user.role in ['superadmin', 'dealer']):
            qs = qs.filter(school=user.school)
        return qs

    def perform_create(self, serializer):
        # 🔒 Automatically associate the shop with the user's school during creation
        serializer.save(school=self.request.user.school)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]
