from rest_framework import views, permissions, status
from rest_framework.response import Response
from django.db import IntegrityError, transaction

from core.permissions import IsAdmin, IsTeacher
from .teacher_access import teacher_accessible_class_sections_queryset
from students.models import StudentProfile
from django.db.models import Q

from .models import ClassSection, MainClass, MainSection
from .serializers import ClassSectionSerializer, MainClassSerializer, MainSectionSerializer

class ClassSectionListView(views.APIView):
    """
    List all available class-section mappings for the user's school.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        school = request.user.school
        if not school and not request.user.is_superuser:
            return Response([])

        qs = ClassSection.objects.select_related(
            'class_ref',
            'section_ref',
            'class_teacher__user',
        ).all()
        if not request.user.is_superuser:
            qs = qs.filter(school=school)
        
        serializer = ClassSectionSerializer(qs, many=True)
        return Response(serializer.data)


class TeacherTeachingSectionsView(views.APIView):
    """
    Sections the current teacher may access: class teacher OR subject teacher (TeacherAssignment / Subject.teachers).
    """

    permission_classes = [IsTeacher]

    def get(self, request):
        profile = getattr(request.user, 'teacher_profile', None)
        if not profile:
            return Response([])
        school = None if request.user.is_superuser else request.user.school
        qs = teacher_accessible_class_sections_queryset(profile, school)
        serializer = ClassSectionSerializer(qs, many=True)
        return Response(serializer.data)


class MainClassListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        school = request.user.school
        qs = MainClass.objects.all().order_by('id')
        if not request.user.is_superuser:
            qs = qs.filter(school=school)

        serializer = MainClassSerializer(qs, many=True)
        return Response(serializer.data)


class MainSectionListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        school = request.user.school
        qs = MainSection.objects.all().order_by('id')
        if not request.user.is_superuser:
            qs = qs.filter(school=school)
        serializer = MainSectionSerializer(qs, many=True)
        return Response(serializer.data)


class AdminMainClassCreateView(views.APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        school = request.user.school
        name = (request.data.get('name') or '').strip()
        code = (request.data.get('code') or '').strip() or None
        description = (request.data.get('description') or '').strip() or None
        if not name:
            return Response({"error": "name is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        obj, created = MainClass.objects.get_or_create(
            school=school,
            name=name,
            defaults={'code': code, 'description': description},
        )
        if created:
            # Automatic Initialization of section 'A'
            section_obj, _ = MainSection.objects.get_or_create(school=school, name='A')
            ClassSection.objects.get_or_create(
                school=school,
                class_ref=obj,
                section_ref=section_obj
            )
        elif code is not None or description is not None:
            if code is not None:
                obj.code = code
            if description is not None:
                obj.description = description
            obj.save(update_fields=['code', 'description'])
        return Response(
            {
                "message": "Class created" if created else "Class already exists",
                "id": obj.id,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class AdminMainSectionCreateView(views.APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        school = request.user.school
        name = request.data.get('name')
        if not name:
            return Response({"error": "name is required"}, status=status.HTTP_400_BAD_REQUEST)

        obj, created = MainSection.objects.get_or_create(school=school, name=name)
        return Response(
            {"message": "Section created" if created else "Section already exists", "id": obj.id},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class AdminMainClassDetailView(views.APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, class_id: int):
        school = request.user.school
        obj = MainClass.objects.filter(school=school, id=class_id).first()
        if not obj:
            return Response({"error": "Class not found"}, status=status.HTTP_404_NOT_FOUND)

        name = request.data.get('name')
        code = request.data.get('code')
        description = request.data.get('description')

        if name is not None:
            next_name = name.strip()
            if not next_name:
                return Response({"error": "name cannot be empty"}, status=status.HTTP_400_BAD_REQUEST)
            if MainClass.objects.filter(school=school, name=next_name).exclude(id=obj.id).exists():
                return Response({"error": "Class name already exists"}, status=status.HTTP_400_BAD_REQUEST)
            if next_name:
                obj.name = next_name
        if code is not None:
            obj.code = (code or '').strip() or None
        if description is not None:
            obj.description = (description or '').strip() or None

        obj.save()
        return Response(MainClassSerializer(obj).data)

    def delete(self, request, class_id: int):
        school = request.user.school
        obj = MainClass.objects.filter(school=school, id=class_id).first()
        if not obj:
            return Response({"error": "Class not found"}, status=status.HTTP_404_NOT_FOUND)
        try:
            with transaction.atomic():
                section_ids = list(obj.sections.values_list('id', flat=True))
                if section_ids:
                    # Keep student accounts and detach class assignment before deleting sections.
                    StudentProfile.objects.filter(class_section_id__in=section_ids).update(class_section=None)
                obj.delete()
            return Response({"message": "Class deleted successfully"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Failed to delete class: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class AdminClassSectionCreateView(views.APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        school = request.user.school
        class_id = request.data.get('class_id')
        section_name = (request.data.get('section_name') or '').strip()
        class_teacher_id = request.data.get('class_teacher')
        room_number = (request.data.get('room_number') or '').strip() or None

        if not class_id or not section_name:
            return Response({"error": "class_id and section_name are required"}, status=status.HTTP_400_BAD_REQUEST)

        class_obj = MainClass.objects.filter(school=school, id=class_id).first()
        if not class_obj:
            return Response({"error": "Class not found"}, status=status.HTTP_404_NOT_FOUND)

        section_obj, _ = MainSection.objects.get_or_create(school=school, name=section_name)

        if ClassSection.objects.filter(school=school, class_ref=class_obj, section_ref=section_obj).exists():
            return Response({"error": "This section already exists in selected class"}, status=status.HTTP_400_BAD_REQUEST)

        obj = ClassSection.objects.create(
            school=school,
            class_ref=class_obj,
            section_ref=section_obj,
            class_teacher_id=class_teacher_id or None,
            room_number=room_number,
        )
        obj = ClassSection.objects.select_related('class_ref', 'section_ref', 'class_teacher__user').get(id=obj.id)
        return Response(ClassSectionSerializer(obj).data, status=status.HTTP_201_CREATED)


class AdminClassSectionDetailView(views.APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, section_id: int):
        school = request.user.school
        obj = ClassSection.objects.select_related('class_ref', 'section_ref', 'class_teacher__user').filter(school=school, id=section_id).first()
        if not obj:
            return Response({"error": "Section not found"}, status=status.HTTP_404_NOT_FOUND)

        class_id = request.data.get('class_id')
        section_name = request.data.get('section_name')
        class_teacher_id = request.data.get('class_teacher')
        room_number = request.data.get('room_number')

        target_class = obj.class_ref
        target_section = obj.section_ref

        if class_id is not None:
            target_class = MainClass.objects.filter(school=school, id=class_id).first()
            if not target_class:
                return Response({"error": "Class not found"}, status=status.HTTP_404_NOT_FOUND)

        if section_name is not None:
            next_name = section_name.strip()
            if not next_name:
                return Response({"error": "section_name cannot be empty"}, status=status.HTTP_400_BAD_REQUEST)
            target_section, _ = MainSection.objects.get_or_create(school=school, name=next_name)

        if ClassSection.objects.filter(school=school, class_ref=target_class, section_ref=target_section).exclude(id=obj.id).exists():
            return Response({"error": "Duplicate section in same class"}, status=status.HTTP_400_BAD_REQUEST)

        obj.class_ref = target_class
        obj.section_ref = target_section

        if class_teacher_id is not None:
            # optionally verify teacher belongs to school
            obj.class_teacher_id = class_teacher_id or None
        if room_number is not None:
            obj.room_number = (room_number or '').strip() or None

        obj.save()
        obj.refresh_from_db()
        return Response(ClassSectionSerializer(obj).data)

    def delete(self, request, section_id: int):
        school = request.user.school
        obj = ClassSection.objects.filter(school=school, id=section_id).first()
        if not obj:
            return Response({"error": "Section not found"}, status=status.HTTP_404_NOT_FOUND)
        try:
            with transaction.atomic():
                StudentProfile.objects.filter(class_section=obj).update(class_section=None)
                obj.delete()
            return Response({"message": "Section deleted successfully"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Failed to delete section: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class AdminClassSectionListView(views.APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        school = request.user.school
        class_id = request.query_params.get('class_id')
        search = (request.query_params.get('search') or '').strip()

        qs = ClassSection.objects.select_related(
            'class_ref',
            'section_ref',
            'class_teacher__user',
        ).filter(school=school)
        if class_id:
            qs = qs.filter(class_ref_id=class_id)
        if search:
            qs = qs.filter(
                Q(class_ref__name__icontains=search)
                | Q(section_ref__name__icontains=search)
            )
        qs = qs.order_by('class_ref__name', 'section_ref__name')
        return Response(ClassSectionSerializer(qs, many=True).data)


class AdminClassSectionHierarchyView(views.APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        school = request.user.school
        classes = MainClass.objects.filter(school=school).order_by('name')
        
        # Self-healing: Ensure every class has at least one section (A)
        # This fixes classes created before this automation.
        classes_with_no_sections = classes.filter(sections__isnull=True)
        if classes_with_no_sections.exists():
            default_section, _ = MainSection.objects.get_or_create(school=school, name='A')
            for c in classes_with_no_sections:
                ClassSection.objects.get_or_create(
                    school=school,
                    class_ref=c,
                    section_ref=default_section
                )

        sections = ClassSection.objects.select_related(
            'class_ref',
            'section_ref',
            'class_teacher__user',
        ).filter(school=school).order_by('class_ref__name', 'section_ref__name')

        by_class = {c.id: [] for c in classes}
        for cs in sections:
            if cs.class_ref_id in by_class:
                by_class[cs.class_ref_id].append({
                    "id": cs.id,
                    "section_name": cs.section_ref.name,
                    "class_teacher": cs.class_teacher_id,
                    "class_teacher_name": (cs.class_teacher.user.name or cs.class_teacher.user.username) if cs.class_teacher else None,
                    "room_number": cs.room_number,
                    "student_count": cs.students.count(),
                })

        payload = []
        for c in classes:
            payload.append({
                "id": c.id,
                "name": c.name,
                "code": c.code,
                "description": c.description,
                "sections": by_class.get(c.id, []),
            })
        return Response(payload)


class AdminAssignStudentSectionView(views.APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        school = request.user.school
        student_id = request.data.get('student_id')
        class_section_id = request.data.get('class_section_id')
        if not student_id or not class_section_id:
            return Response({"error": "student_id and class_section_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        student = StudentProfile.objects.select_related('user').filter(
            Q(school=school) | Q(user__school=school),
            id=student_id,
        ).first()
        if not student:
            return Response({"error": "Student not found"}, status=status.HTTP_404_NOT_FOUND)

        class_section = ClassSection.objects.filter(school=school, id=class_section_id).first()
        if not class_section:
            return Response({"error": "ClassSection not found"}, status=status.HTTP_404_NOT_FOUND)

        if student.class_section_id == class_section.id:
            return Response({"message": "Student is already assigned to this section"}, status=status.HTTP_200_OK)

        if student.roll_number:
            conflict = StudentProfile.objects.select_related('user').filter(
                class_section=class_section,
                roll_number=student.roll_number,
            ).exclude(id=student.id).first()
            if conflict:
                conflict_name = conflict.user.name or conflict.user.username
                return Response(
                    {
                        "error": (
                            f"Roll number {student.roll_number} is already used by "
                            f"{conflict_name} in {class_section.class_ref.name} - "
                            f"{class_section.section_ref.name}. Update the roll number before assigning."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        student.class_section = class_section
        try:
            student.save(update_fields=['class_section'])
        except IntegrityError:
            return Response(
                {"error": "Another student in this section already has the same roll number."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"message": "Student assigned successfully"}, status=status.HTTP_200_OK)
