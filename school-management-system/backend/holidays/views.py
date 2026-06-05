import calendar
from datetime import date
from io import BytesIO
import csv

from django.db.models import Count, Q
from django.http import HttpResponse
from rest_framework import permissions, status, views
from rest_framework.response import Response

from classes.models import MainClass
from core.permissions import IsAdmin
from students.models import StudentProfile

from .models import Holiday
from .serializers import HolidayListSerializer, HolidaySerializer


def _parse_int(v):
    try:
        return int(v)
    except Exception:
        return None


class HolidayListCreateView(views.APIView):
    """
    GET:
      - Supports filtering by month/year/type/search and (optional) class_id.
      - For students: automatically filters by their class.
    POST:
      - Admin only. Prevents overlapping holidays (no duplicate date/range overlaps).
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        school = request.user.school
        qs = Holiday.objects.prefetch_related('applicable_classes').all()
        
        if not request.user.is_superuser:
            qs = qs.filter(school=school)

        search = request.query_params.get('search')
        type_filter = request.query_params.get('type')
        month = _parse_int(request.query_params.get('month'))
        year = _parse_int(request.query_params.get('year')) or date.today().year

        class_id = request.query_params.get('class_id')
        if not class_id and request.user.role == 'student':
            from students.utils import get_requested_student
            student_profile = get_requested_student(request)
            if student_profile and student_profile.class_section:
                class_id = student_profile.class_section.class_ref_id

        if type_filter:
            qs = qs.filter(type=type_filter)

        if search:
            qs = qs.filter(title__icontains=search)

        if month:
            month = max(1, min(12, month))
            month_start = date(year, month, 1)
            last_day = calendar.monthrange(year, month)[1]
            month_end = date(year, month, last_day)

            qs = qs.filter(start_date__lte=month_end).filter(
                Q(end_date__isnull=True, start_date__gte=month_start)
                | Q(end_date__isnull=False, end_date__gte=month_start)
            )

        if class_id:
            class_id = int(class_id)
            qs = (
                qs.annotate(applicable_count=Count('applicable_classes'))
                .filter(Q(applicable_count=0) | Q(applicable_classes__id=class_id))
                .distinct()
            )

        qs = qs.order_by('start_date', 'id')
        return Response(HolidayListSerializer(qs, many=True).data)

    def post(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

        school = request.user.school
        serializer = HolidaySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        start_date = serializer.validated_data.get('start_date')
        end_date = serializer.validated_data.get('end_date') or start_date

        if end_date < start_date:
            return Response({'error': 'end_date cannot be before start_date'}, status=status.HTTP_400_BAD_REQUEST)

        qs = Holiday.objects.filter(school=school)
        if qs.filter(
            start_date__lte=end_date
        ).filter(
            Q(end_date__isnull=True, start_date__gte=start_date) |
            Q(end_date__isnull=False, end_date__gte=start_date)
        ).exists():
            return Response({'error': 'Holiday overlaps with an existing holiday date range'}, status=status.HTTP_400_BAD_REQUEST)

        holiday = serializer.save(school=school)
        return Response(HolidayListSerializer(holiday).data, status=status.HTTP_201_CREATED)


class HolidayDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk: int):
        school = request.user.school
        qs = Holiday.objects.prefetch_related('applicable_classes').filter(pk=pk)
        if not request.user.is_superuser:
            qs = qs.filter(school=school)
            
        h = qs.first()
        if not h:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(HolidayListSerializer(h).data)

    def patch(self, request, pk: int):
        if request.user.role != 'admin':
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

        school = request.user.school
        instance = Holiday.objects.filter(school=school, pk=pk).first()
        if not instance:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = HolidaySerializer(instance, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        start_date = serializer.validated_data.get('start_date', instance.start_date)
        end_date = serializer.validated_data.get('end_date')
        if end_date is None:
            end_date = instance.end_date or instance.start_date

        if end_date < start_date:
            return Response({'error': 'end_date cannot be before start_date'}, status=status.HTTP_400_BAD_REQUEST)

        qs = Holiday.objects.filter(school=school).exclude(id=instance.id)
        if qs.filter(
            start_date__lte=end_date
        ).filter(
            Q(end_date__isnull=True, start_date__gte=start_date) |
            Q(end_date__isnull=False, end_date__gte=start_date)
        ).exists():
            return Response({'error': 'Holiday overlaps with an existing holiday date range'}, status=status.HTTP_400_BAD_REQUEST)

        holiday = serializer.save()
        return Response(HolidayListSerializer(holiday).data)

    def delete(self, request, pk: int):
        if request.user.role != 'admin':
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

        school = request.user.school
        instance = Holiday.objects.filter(school=school, pk=pk).first()
        if not instance:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        instance.delete()
        return Response({'message': 'Holiday deleted successfully'}, status=status.HTTP_200_OK)


class HolidayExportCSVView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

        school = request.user.school
        qs = Holiday.objects.prefetch_related('applicable_classes').filter(school=school)

        search = request.query_params.get('search')
        type_filter = request.query_params.get('type')
        month = _parse_int(request.query_params.get('month'))
        year = _parse_int(request.query_params.get('year')) or date.today().year
        class_id = request.query_params.get('class_id')

        if type_filter:
            qs = qs.filter(type=type_filter)
        if search:
            qs = qs.filter(title__icontains=search)

        if month:
            month = max(1, min(12, month))
            month_start = date(year, month, 1)
            last_day = calendar.monthrange(year, month)[1]
            month_end = date(year, month, last_day)
            qs = qs.filter(start_date__lte=month_end).filter(
                Q(end_date__isnull=True, start_date__gte=month_start)
                | Q(end_date__isnull=False, end_date__gte=month_start)
            )

        if class_id:
            class_id = int(class_id)
            qs = (
                qs.annotate(applicable_count=Count('applicable_classes'))
                .filter(Q(applicable_count=0) | Q(applicable_classes__id=class_id))
                .distinct()
            )

        qs = qs.order_by('start_date', 'id')

        buf = BytesIO()
        writer = csv.writer(buf)
        writer.writerow(['Title', 'Start Date', 'End Date', 'Type', 'Applicable Classes', 'Description'])

        for h in qs:
            class_names = [c.name for c in (h.applicable_classes.all() or [])]
            applicable = ', '.join(class_names) if class_names else 'All Classes'
            writer.writerow([
                h.title,
                h.start_date.isoformat() if h.start_date else '',
                h.end_date.isoformat() if h.end_date else '',
                h.type,
                applicable,
                h.description or '',
            ])

        response = HttpResponse(buf.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="holidays.csv"'
        return response
