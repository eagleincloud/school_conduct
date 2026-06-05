import base64

from django.db.models import Q
from django.core.files.base import ContentFile
from django.utils.text import slugify
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdmin, IsTeacher
from academics.models import Exam, Result
from classes.models import ClassSection
from teachers.models import TeacherProfile

from .models import Subject, SubjectNote, SubjectAssignment, TeacherAssignment
from .serializers import (
    SubjectListSerializer,
    SubjectNoteSerializer,
    SubjectAssignmentSerializer,
    TeacherAssignmentSerializer,
)


def _strip_base64_prefix(data: str) -> str:
    if not data:
        return data
    if ',' in data:
        return data.split(',', 1)[1]
    return data


def decode_base64_to_content_file(file_base64: str, filename: str):
    if not file_base64:
        return None
    decoded = base64.b64decode(_strip_base64_prefix(file_base64))
    return ContentFile(decoded, name=filename)


class SubjectListView(APIView):
    """
    Admin-only list.
    Supports query params: class_id, search, status.
    """

    permission_classes = [IsAdmin | IsTeacher]

    def get(self, request):
        school = request.user.school
        class_id = request.query_params.get('class_id')
        search = request.query_params.get('search')
        status_filter = request.query_params.get('status')

        qs = Subject.objects.select_related('class_ref').prefetch_related('teachers')
        if not request.user.is_superuser:
            qs = qs.filter(school=school)

        if class_id:
            qs = qs.filter(class_ref_id=class_id)

        if status_filter and status_filter != 'all':
            qs = qs.filter(status=status_filter)

        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search) | Q(description__icontains=search))

        qs = qs.order_by('class_ref__name', 'name')
        serializer = SubjectListSerializer(qs, many=True)
        return Response(serializer.data)


class SubjectCreateView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        school = request.user.school
        name = (request.data.get('name') or request.data.get('subject_name') or '').strip()
        class_id = request.data.get('class_id')
        code = request.data.get('code') or request.data.get('subject_code') or None
        description = request.data.get('description') or None
        status_value = request.data.get('status') or 'Active'
        teacher_ids = request.data.get('teacher_ids') or []

        if not name or not class_id:
            return Response({"error": "name and class_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        # Prevent duplicates (case-insensitive) in same class.
        if Subject.objects.filter(school=school, class_ref_id=class_id, name__iexact=name).exists():
            return Response({"error": "Duplicate subject in same class"}, status=status.HTTP_400_BAD_REQUEST)

        subject = Subject.objects.create(
            school=school,
            class_ref_id=class_id,
            name=name,
            code=code,
            description=description,
            status=status_value,
        )

        if teacher_ids:
            teachers = TeacherProfile.objects.filter(user__school=school, id__in=teacher_ids)
            subject.teachers.set(teachers)

        subject.refresh_from_db()
        serializer = SubjectListSerializer(subject)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SubjectUpdateDeleteView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, subject_id: int):
        school = request.user.school
        subject = Subject.objects.filter(school=school, id=subject_id).prefetch_related('teachers').first()
        if not subject:
            return Response({"error": "Subject not found"}, status=status.HTTP_404_NOT_FOUND)

        name = request.data.get('name')
        code = request.data.get('code')
        description = request.data.get('description')
        status_value = request.data.get('status')
        class_id = request.data.get('class_id')
        teacher_ids = request.data.get('teacher_ids')

        new_name = (name.strip() if isinstance(name, str) else subject.name)
        new_class_id = (class_id if class_id is not None else subject.class_ref_id)

        if new_name and new_class_id:
            if Subject.objects.filter(school=school, class_ref_id=new_class_id, name__iexact=new_name).exclude(id=subject.id).exists():
                return Response({"error": "Duplicate subject in same class"}, status=status.HTTP_400_BAD_REQUEST)

        if name is not None:
            subject.name = name.strip()
        if code is not None:
            subject.code = code
        if description is not None:
            subject.description = description
        if status_value is not None:
            subject.status = status_value
        if class_id is not None:
            subject.class_ref_id = class_id

        if teacher_ids is not None:
            teachers = TeacherProfile.objects.filter(user__school=school, id__in=teacher_ids)
            subject.teachers.set(teachers)
            
            # Dynamic Sync: Ensure TeacherAssignment records are updated for all sections of this class
            # This ensures that changing a teacher on the Subject edit page reflects in the Teacher's access immediately.
            from classes.models import ClassSection
            sections = ClassSection.objects.filter(class_ref=subject.class_ref)
            
            # For each teacher selected, ensure they are assigned as 'Subject Teacher' for all sections if not already.
            # (Simplification: if many teachers are assigned to a subject, they all get access to all sections of that class)
            for teacher in teachers:
                for section in sections:
                    TeacherAssignment.objects.get_or_create(
                        teacher=teacher,
                        class_ref=subject.class_ref,
                        section=section,
                        subject=subject,
                        defaults={'role': 'Subject Teacher'}
                    )
            
            # Clean up old assignments for teachers NOT in the new list for this specific subject/class
            TeacherAssignment.objects.filter(
                class_ref=subject.class_ref,
                subject=subject
            ).exclude(teacher__id__in=teacher_ids).delete()

        subject.save()
        serializer = SubjectListSerializer(subject)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, subject_id: int):
        school = request.user.school
        subject = Subject.objects.filter(school=school, id=subject_id).first()
        if not subject:
            return Response({"error": "Subject not found"}, status=status.HTTP_404_NOT_FOUND)
        subject.delete()
        return Response({"message": "Subject deleted successfully"}, status=status.HTTP_200_OK)


class SubjectDetailsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, subject_id: int):
        school = request.user.school
        subject = (
            Subject.objects.select_related('class_ref')
            .prefetch_related('teachers', 'notes', 'assignments')
            .filter(school=school, id=subject_id)
            .first()
        )
        if not subject:
            return Response({"error": "Subject not found"}, status=status.HTTP_404_NOT_FOUND)

        teachers = [
            {"id": t.id, "name": t.user.name or t.user.username, "employee_id": t.employee_id}
            for t in subject.teachers.all()
        ]

        notes_qs = subject.notes.all().order_by('-created_at')
        notes = SubjectNoteSerializer(notes_qs, many=True).data

        assignments_qs = subject.assignments.all().order_by('-created_at')
        assignments = SubjectAssignmentSerializer(assignments_qs, many=True).data

        return Response({
            "id": subject.id,
            "name": subject.name,
            "code": subject.code,
            "class_id": subject.class_ref_id,
            "class_name": subject.class_ref.name if subject.class_ref else None,
            "teachers": teachers,
            "description": subject.description,
            "status": subject.status,
            "notes": notes,
            "assignments": assignments,
        })


class SubjectNoteListCreateView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, subject_id: int):
        school = request.user.school
        subject = Subject.objects.filter(school=school, id=subject_id).first()
        if not subject:
            return Response({"error": "Subject not found"}, status=status.HTTP_404_NOT_FOUND)
            
        notes_qs = SubjectNote.objects.filter(subject=subject).order_by('-created_at')
        return Response(SubjectNoteSerializer(notes_qs, many=True).data)

    def post(self, request, subject_id: int):
        school = request.user.school
        subject = Subject.objects.filter(school=school, id=subject_id).first()
        if not subject:
            return Response({"error": "Subject not found"}, status=status.HTTP_404_NOT_FOUND)

        title = (request.data.get('title') or '').strip()
        description = request.data.get('description') or None
        link_url = request.data.get('link_url') or None

        file_base64 = request.data.get('file_base64')
        file_name = request.data.get('file_name') or None

        if not title:
            return Response({"error": "title is required"}, status=status.HTTP_400_BAD_REQUEST)

        note = SubjectNote.objects.create(
            subject=subject,
            title=title,
            description=description,
            link_url=link_url,
        )

        if file_base64:
            safe_name = file_name or f"{slugify(title)}"
            if '.' not in safe_name:
                safe_name = f"{safe_name}.pdf"
            content = decode_base64_to_content_file(file_base64, safe_name)
            note.file.save(safe_name, content, save=True)

        return Response(SubjectNoteSerializer(note).data, status=status.HTTP_201_CREATED)


class SubjectNoteDeleteView(APIView):
    permission_classes = [IsAdmin]

    def delete(self, request, note_id: int):
        school = request.user.school
        note = SubjectNote.objects.filter(subject__school=school, id=note_id).first()
        if not note:
            return Response({"error": "Note not found"}, status=status.HTTP_404_NOT_FOUND)
        note.delete()
        return Response({"message": "Note deleted successfully"}, status=status.HTTP_200_OK)


class SubjectAssignmentListCreateView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, subject_id: int):
        school = request.user.school
        subject = Subject.objects.filter(school=school, id=subject_id).first()
        if not subject:
            return Response({"error": "Subject not found"}, status=status.HTTP_404_NOT_FOUND)
            
        qs = SubjectAssignment.objects.filter(subject=subject).order_by('-created_at')
        return Response(SubjectAssignmentSerializer(qs, many=True).data)

    def post(self, request, subject_id: int):
        school = request.user.school
        subject = Subject.objects.filter(school=school, id=subject_id).first()
        if not subject:
            return Response({"error": "Subject not found"}, status=status.HTTP_404_NOT_FOUND)

        title = (request.data.get('title') or '').strip()
        due_date = request.data.get('due_date')
        file_base64 = request.data.get('file_base64')
        file_name = request.data.get('file_name') or None

        if not title or not due_date:
            return Response({"error": "title and due_date are required"}, status=status.HTTP_400_BAD_REQUEST)

        assignment = SubjectAssignment.objects.create(
            subject=subject,
            title=title,
            due_date=due_date,
        )

        if file_base64:
            safe_name = file_name or f"{slugify(title)}"
            if '.' not in safe_name:
                safe_name = f"{safe_name}.pdf"
            content = decode_base64_to_content_file(file_base64, safe_name)
            assignment.file.save(safe_name, content, save=True)

        return Response(SubjectAssignmentSerializer(assignment).data, status=status.HTTP_201_CREATED)


class SubjectAssignmentDeleteView(APIView):
    permission_classes = [IsAdmin]

    def delete(self, request, assignment_id: int):
        school = request.user.school
        assignment = SubjectAssignment.objects.filter(subject__school=school, id=assignment_id).first()
        if not assignment:
            return Response({"error": "Assignment not found"}, status=status.HTTP_404_NOT_FOUND)
        assignment.delete()
        return Response({"message": "Assignment deleted successfully"}, status=status.HTTP_200_OK)


class SubjectMarksView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, subject_id: int):
        school = request.user.school
        subject = Subject.objects.select_related('class_ref').filter(school=school, id=subject_id).first()
        if not subject:
            return Response({"error": "Subject not found"}, status=status.HTTP_404_NOT_FOUND)

        class_sections = ClassSection.objects.filter(school=school, class_ref_id=subject.class_ref_id).values_list('id', flat=True)
        exams = Exam.objects.filter(class_section_id__in=class_sections).values_list('id', flat=True)

        results = (
            Result.objects.filter(exam_id__in=list(exams), subject__iexact=subject.name)
            .select_related('student__user', 'exam')
            .order_by('-exam__date', '-id')
        )

        data = []
        for r in results:
            student_name = r.student.user.name or r.student.user.username
            data.append({
                "id": r.id,
                "student_id": r.student_id,
                "student_name": student_name,
                "exam_name": r.exam.name if r.exam else None,
                "marks": str(r.marks),
                "max_marks": str(r.max_marks),
            })
        return Response(data)


class TeacherAssignmentListCreateView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        school = request.user.school
        class_id = request.query_params.get('class_id')
        teacher_search = (request.query_params.get('teacher_search') or '').strip()

        qs = TeacherAssignment.objects.select_related(
            'teacher__user',
            'class_ref',
            'section__section_ref',
            'subject',
        ).filter(subject__school=school)

        if class_id:
            qs = qs.filter(class_ref_id=class_id)

        if teacher_search:
            qs = qs.filter(
                Q(teacher__user__name__icontains=teacher_search)
                | Q(teacher__user__username__icontains=teacher_search)
                | Q(teacher__employee_id__icontains=teacher_search)
            )

        serializer = TeacherAssignmentSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        print("DEBUG POST DATA:", request.data)
        school = request.user.school
        teacher_id = request.data.get('teacher_id')
        class_id = request.data.get('class_id')
        section_id = request.data.get('section') or request.data.get('section_id')
        subject_id = request.data.get('subject_id')
        role = request.data.get('role') or 'Subject Teacher'

        if not teacher_id or not class_id or not subject_id:
            return Response(
                {"error": "teacher_id, class_id and subject_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subject = Subject.objects.filter(school=school, id=subject_id).first()
        if not subject:
            return Response({"error": "Subject not found"}, status=status.HTTP_404_NOT_FOUND)
            
        teacher = TeacherProfile.objects.filter(user__school=school, id=teacher_id).first()
        if not teacher:
            return Response({"error": "Teacher not found or belongs to another school"}, status=status.HTTP_404_NOT_FOUND)

        if int(subject.class_ref_id) != int(class_id):
            return Response(
                {"error": "Selected subject does not belong to selected class"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if section_id:
            section_obj = ClassSection.objects.filter(school=school, id=section_id).first()
            if not section_obj:
                return Response({"error": "Section not found"}, status=status.HTTP_404_NOT_FOUND)
            if int(section_obj.class_ref_id) != int(class_id):
                return Response({"error": "Selected section does not belong to selected class"}, status=status.HTTP_400_BAD_REQUEST)

        duplicateQuery = Q(
            teacher_id=teacher_id,
            class_ref_id=class_id,
            subject_id=subject_id,
        )
        if section_id:
            duplicateQuery &= Q(section_id=section_id)
        else:
            duplicateQuery &= Q(section__isnull=True)

        duplicate = TeacherAssignment.objects.filter(duplicateQuery).exists()
        if duplicate:
            return Response(
                {"error": "This teacher is already assigned to this class and subject"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            assignment = TeacherAssignment.objects.create(
                teacher=teacher,
                class_ref_id=class_id,
                section_id=section_id or None,
                subject=subject,
                role=role,
            )
            assignment = TeacherAssignment.objects.select_related('teacher__user', 'class_ref', 'section', 'subject').get(id=assignment.id)
            return Response(TeacherAssignmentSerializer(assignment).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            import traceback
            print(traceback.format_exc())
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TeacherAssignmentDetailView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, assignment_id: int):
        school = request.user.school
        assignment = TeacherAssignment.objects.select_related('teacher__user', 'class_ref', 'subject').filter(subject__school=school, id=assignment_id).first()
        if not assignment:
            return Response({"error": "Assignment not found"}, status=status.HTTP_404_NOT_FOUND)

        teacher_id = request.data.get('teacher_id', assignment.teacher_id)
        class_id = request.data.get('class_id', assignment.class_ref_id)
        section_id = request.data.get('section', request.data.get('section_id', assignment.section_id))
        subject_id = request.data.get('subject_id', assignment.subject_id)
        role = request.data.get('role', assignment.role)

        subject = Subject.objects.filter(school=school, id=subject_id).first()
        if not subject:
            return Response({"error": "Subject not found"}, status=status.HTTP_404_NOT_FOUND)

        teacher = TeacherProfile.objects.filter(user__school=school, id=teacher_id).first()
        if not teacher:
            return Response({"error": "Teacher not found or belongs to another school"}, status=status.HTTP_404_NOT_FOUND)

        if int(subject.class_ref_id) != int(class_id):
            return Response(
                {"error": "Selected subject does not belong to selected class"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if section_id:
            section_obj = ClassSection.objects.filter(school=school, id=section_id).first()
            if not section_obj:
                return Response({"error": "Section not found"}, status=status.HTTP_404_NOT_FOUND)
            if int(section_obj.class_ref_id) != int(class_id):
                return Response({"error": "Selected section does not belong to selected class"}, status=status.HTTP_400_BAD_REQUEST)

        duplicateQuery = Q(
            teacher_id=teacher_id,
            class_ref_id=class_id,
            subject_id=subject_id,
        )
        if section_id:
            duplicateQuery &= Q(section_id=section_id)
        else:
            duplicateQuery &= Q(section__isnull=True)

        duplicate = TeacherAssignment.objects.filter(duplicateQuery).exclude(id=assignment.id).exists()
        if duplicate:
            return Response(
                {"error": "This teacher is already assigned to this class and subject"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignment.teacher_id = teacher_id
        assignment.class_ref_id = class_id
        assignment.section_id = section_id or None
        assignment.subject_id = subject_id
        assignment.role = role
        assignment.save()
        assignment.refresh_from_db()
        assignment = TeacherAssignment.objects.select_related('teacher__user', 'class_ref', 'section', 'subject').get(id=assignment.id)
        return Response(TeacherAssignmentSerializer(assignment).data)

    def delete(self, request, assignment_id: int):
        school = request.user.school
        assignment = TeacherAssignment.objects.filter(subject__school=school, id=assignment_id).first()
        if not assignment:
            return Response({"error": "Assignment not found"}, status=status.HTTP_404_NOT_FOUND)
        assignment.delete()
        return Response({"message": "Assignment deleted successfully"}, status=status.HTTP_200_OK)
