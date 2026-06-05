from rest_framework import viewsets, permissions
from .models import TimeTableEntry, Shift
from .serializers import TimeTableEntrySerializer, ShiftSerializer
from rest_framework.decorators import action
from rest_framework.response import Response

class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom permission to allow only admins to edit, 
    but others to read based on their roles.
    """
    def has_permission(self, request, view):
        if request.user.is_authenticated:
            if request.method in permissions.SAFE_METHODS:
                return True
            return request.user.role == 'admin'
        return False

class ShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        school = getattr(user, 'school', None)
        queryset = Shift.objects.all()
        if not user.is_superuser and school:
            queryset = queryset.filter(school=school)
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(school=getattr(user, 'school', None))

class TimeTableViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Time Table entries.
    Admin: Full CRUD (requires class_name and section params).
    Teacher: Read-only access to their assigned classes.
    Student: Read-only access to their class schedule.
    """
    queryset = TimeTableEntry.objects.all().select_related('teacher', 'shift_ref')
    serializer_class = TimeTableEntrySerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        school = getattr(user, 'school', None)
        queryset = TimeTableEntry.objects.all().select_related('teacher', 'shift_ref')
        
        shift_id = self.request.query_params.get('shift_id')
        teacher_id = self.request.query_params.get('teacher_id')
        class_compact = self.request.query_params.get('class')

        # Enforce tenant boundary unless superuser
        if not user.is_superuser and school:
            queryset = queryset.filter(school=school)
            
        if shift_id:
            queryset = queryset.filter(shift_ref_id=shift_id)

        if user.role == 'admin':
            class_name = self.request.query_params.get('class_name')
            section = self.request.query_params.get('section')
            
            if teacher_id:
                return queryset.filter(teacher_id=teacher_id)
                
            if class_compact and '-' in class_compact:
                left, right = class_compact.split('-', 1)
                class_name = class_name or left.strip()
                section = section or right.strip()
            if class_name and section:
                return queryset.filter(class_name=class_name, section=section)
            # Admin can see all if no filters, but user asked for specific behavior
            return queryset
        
        if user.role == 'teacher':
            return queryset.filter(teacher=user, shift_ref__isnull=False).order_by('day', 'period_number')
        
        if user.role == 'student':
            from students.utils import get_requested_student
            student = get_requested_student(self.request)
            if student and student.class_section:
                qs = queryset.filter(
                    class_name=student.class_section.class_ref.name,
                    section=student.class_section.section_ref.name,
                    shift_ref__isnull=False
                )

                # If student is assigned to a specific shift, filter by it
                if student.class_section.assigned_shift_id:
                    qs = qs.filter(shift_ref_id=student.class_section.assigned_shift_id)
                return qs
            return queryset.none()
        
        return queryset.none()

    def perform_create(self, serializer):
        from django.core.exceptions import ValidationError as DjangoValidationError
        from rest_framework.exceptions import ValidationError as DRFValidationError
        user = self.request.user
        try:
            if not getattr(user, 'is_superuser', False):
                serializer.save(school=getattr(user, 'school', None))
            else:
                serializer.save()
        except DjangoValidationError as e:
            errors = e.message_dict.copy() if hasattr(e, 'message_dict') else {'non_field_errors': getattr(e, 'messages', str(e))}
            if '__all__' in errors:
                errors['non_field_errors'] = errors.pop('__all__')
            raise DRFValidationError(errors)

    def perform_update(self, serializer):
        from django.core.exceptions import ValidationError as DjangoValidationError
        from rest_framework.exceptions import ValidationError as DRFValidationError
        try:
            serializer.save()
        except DjangoValidationError as e:
            errors = e.message_dict.copy() if hasattr(e, 'message_dict') else {'non_field_errors': getattr(e, 'messages', str(e))}
            if '__all__' in errors:
                errors['non_field_errors'] = errors.pop('__all__')
            raise DRFValidationError(errors)

    @action(detail=False, methods=['get'], url_path='user-shift')
    def user_shift(self, request):
        user = request.user
        if user.role == 'student':
            from students.utils import get_requested_student
            student = get_requested_student(request)
            if student and student.class_section:
                return Response({'shift_id': student.class_section.assigned_shift_id})
        elif user.role == 'teacher':
            # Optionally return the first shift where they have a class
            first_entry = TimeTableEntry.objects.filter(teacher=user).first()
            if first_entry:
                return Response({'shift_id': first_entry.shift_ref_id})
        
        # Admin or no shift found: Return first available shift in school
        school = getattr(user, 'school', None)
        first_shift = Shift.objects.filter(school=school).first() if school else Shift.objects.first()
        return Response({'shift_id': first_shift.id if first_shift else None})
