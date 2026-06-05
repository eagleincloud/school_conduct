from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from core.permissions import IsSuperAdmin, IsDealer
from .models import Dealer
from .serializers import DealerSerializer, DealerSchoolSerializer, DealerSelfProfileSerializer
from tenants.models import School

class DealerProfileViewSet(viewsets.ViewSet):
    """
    Dealer's own profile management.
    """
    permission_classes = [IsDealer]

    def list(self, request):
        dealer = request.user.dealer_profile
        serializer = DealerSelfProfileSerializer(dealer)
        return Response(serializer.data)

    def partial_update(self, request, pk=None):
        dealer = request.user.dealer_profile
        serializer = DealerSelfProfileSerializer(dealer, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class DealerViewSet(viewsets.ModelViewSet):
    """
    Superadmin CRUD for Dealers.
    """
    queryset = Dealer.objects.all().select_related('user').prefetch_related('schools')
    serializer_class = DealerSerializer
    permission_classes = [IsSuperAdmin]

    @action(detail=True, methods=['get'])
    def schools(self, request, pk=None):
        dealer = self.get_object()
        schools = dealer.schools.all()
        serializer = DealerSchoolSerializer(schools, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        dealer = self.get_object()
        user = dealer.user
        user.is_active = not user.is_active
        user.save()
        return Response({'status': 'success', 'is_active': user.is_active})

class DealerSchoolViewSet(viewsets.ModelViewSet):
    """
    Dealer's own school management.
    """
    serializer_class = DealerSchoolSerializer
    permission_classes = [IsDealer]

    def get_queryset(self):
        # Only schools created by the logged-in dealer
        return School.objects.filter(dealer=self.request.user.dealer_profile)

    def perform_create(self, serializer):
        # Dealer is automatically assigned in serializer.create
        serializer.save()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"request": self.request})
        return context

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        school = self.get_object()
        school.is_active = not school.is_active
        school.save()
        return Response({'status': 'success', 'is_active': school.is_active})

    @action(detail=True, methods=['get'])
    def admins(self, request, pk=None):
        school = self.get_object()
        admins = school.user_set.filter(role='admin').values('name', 'email', 'username', 'is_active')
        return Response(admins)
