import logging

from django.core.exceptions import ObjectDoesNotExist
from django.db import DatabaseError
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, views, permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from .models import Notification, Message, Conversation
from .serializers import NotificationSerializer, MessageSerializer, ConversationSerializer

from students.models import StudentProfile
from teachers.models import TeacherProfile
from core.permissions import IsTeacher, IsStudent, IsAdmin
from classes.teacher_access import teacher_accessible_class_sections_queryset, teacher_user_ids_for_student_class_section
from academics.models import Exam

logger = logging.getLogger(__name__)


def _teacher_allowed_student_ids(teacher_profile_id: int, school=None):
    profile = TeacherProfile.objects.select_related('user').filter(id=teacher_profile_id).first()
    if not profile:
        return set()
    sch = school if school is not None else getattr(profile.user, 'school', None)
    section_ids = teacher_accessible_class_sections_queryset(profile, sch).values_list('id', flat=True)
    return set(StudentProfile.objects.filter(class_section_id__in=list(section_ids)).values_list('user_id', flat=True))


def _student_allowed_teacher_ids(student_user_id: int):
    sp = StudentProfile.objects.select_related('class_section').filter(user_id=student_user_id).first()
    if not sp or not sp.class_section:
        return set()
    return teacher_user_ids_for_student_class_section(sp.class_section)


def _is_allowed_pair(user, other_user_id: int) -> bool:
    if user.role == 'teacher':
        allowed = _teacher_allowed_student_ids(user.teacher_profile.id, getattr(user, 'school', None))
        return other_user_id in allowed
    if user.role == 'student':
        allowed = _student_allowed_teacher_ids(user.id)
        return other_user_id in allowed
    return False

class MyNotificationsView(views.APIView):
    """
    User can see their own notifications.
    """
    permission_classes = [permissions.IsAuthenticated]

    def _ensure_student_exam_notifications(self, request):
        if request.user.role != 'student':
            return
        from students.utils import get_requested_student
        student_profile = get_requested_student(request)
        if not student_profile:
            return
        if not student_profile.class_section_id:
            return

        today = timezone.localdate()
        # Include upcoming and in-window exams (not only when today is between start and end).
        try:
            exams = (
                Exam.objects.filter(
                    class_section_id=student_profile.class_section_id,
                    end_date__isnull=False,
                    end_date__gte=today,
                )
                .order_by('start_date', 'id')
            )
        except Exception:
            logger.exception('Failed to query exams for notification backfill')
            return

        for exam in exams:
            try:
                if Notification.objects.filter(user=request.user, related_exam_id=exam.pk).exists():
                    continue
                s, e = exam.start_date, exam.end_date
                if s and e:
                    date_text = f'{s} to {e}'
                elif s:
                    date_text = str(s)
                elif e:
                    date_text = str(e)
                else:
                    date_text = 'TBA'
                if s and s > today:
                    title = f'Upcoming exam: {exam.name or "Exam"}'
                    message = (
                        f'{exam.exam_type} "{exam.name}" is scheduled ({date_text}). '
                        f'Open My Exams for the full timetable.'
                    )
                else:
                    title = f'Exam: {exam.name or "Exam"}'
                    message = (
                        f"Exam '{exam.name}' ({date_text}). "
                        f'Please check the timetable in My Exams.'
                    )
                title = title[:255]
                Notification.objects.create(
                    user=request.user,
                    target_role=request.user.role,
                    title=title,
                    message=message,
                    is_read=False,
                    related_exam=exam,
                )
            except Exception:
                logger.warning(
                    'Skipping notification backfill for exam_id=%s user_id=%s',
                    getattr(exam, 'pk', None),
                    request.user.pk,
                    exc_info=True,
                )

    def get(self, request):
        try:
            self._ensure_student_exam_notifications(request)
            target_user = request.user
            if request.user.role == 'student':
                from students.utils import get_requested_student
                sp = get_requested_student(request)
                if sp: target_user = sp.user

            notifications = (
                Notification.objects.filter(user=target_user)
                .select_related('related_exam', 'related_announcement')
                .order_by('-created_at')
            )
            serializer = NotificationSerializer(notifications, many=True)
            return Response(serializer.data)
        except DatabaseError as exc:
            logger.exception('Notifications list database error')
            return Response(
                {
                    'detail': (
                        'Notifications could not be loaded from the database. '
                        'If you recently upgraded the project, run: python manage.py migrate '
                        '(especially app `communication`). '
                        f'Original error: {exc}'
                    ),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception as exc:
            logger.exception('Notifications list failed')
            return Response(
                {'detail': f'Could not load notifications: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class NotificationMarkAllReadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        target_user = request.user
        if request.user.role == 'student':
            from students.utils import get_requested_student
            sp = get_requested_student(request)
            if sp: target_user = sp.user
        updated = Notification.objects.filter(user=target_user, is_read=False).update(is_read=True)
        return Response({'message': 'All notifications marked as read', 'updated': updated})


class NotificationDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, notification_id: int):
        target_user = request.user
        if request.user.role == 'student':
            from students.utils import get_requested_student
            sp = get_requested_student(request)
            if sp: target_user = sp.user
        row = Notification.objects.filter(user=target_user, id=notification_id).first()
        if not row:
            return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)
        row.is_read = bool(request.data.get('is_read', True))
        row.save(update_fields=['is_read'])
        return Response(NotificationSerializer(row).data)

    def delete(self, request, notification_id: int):
        target_user = request.user
        if request.user.role == 'student':
            from students.utils import get_requested_student
            sp = get_requested_student(request)
            if sp: target_user = sp.user
        row = Notification.objects.filter(user=target_user, id=notification_id).first()
        if not row:
            return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)
        row.delete()
        return Response({'message': 'Notification deleted'})


class MessageThreadsView(views.APIView):
    """
    Teacher/Student inbox threads with unread count.

    Query params:
      - class_section_id (teacher only, optional)
      - unread_only (0/1, optional)
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role not in ('teacher', 'student'):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

        unread_only = request.query_params.get('unread_only') in ('1', 'true', 'yes')
        class_section_id = request.query_params.get('class_section_id')

        if request.user.role == 'teacher':
            tp = request.user.teacher_profile
            allowed_student_ids = _teacher_allowed_student_ids(tp.id, getattr(request.user, 'school', None))
            if class_section_id:
                try:
                    class_section_id = int(class_section_id)
                except Exception:
                    return Response({'error': 'Invalid class_section_id'}, status=status.HTTP_400_BAD_REQUEST)
                if class_section_id not in teacher_accessible_class_sections_queryset(
                    tp,
                    getattr(request.user, 'school', None),
                ).values_list('id', flat=True):
                    return Response({'error': 'Not allowed for this class section'}, status=status.HTTP_403_FORBIDDEN)
                filtered_students = StudentProfile.objects.filter(class_section_id=class_section_id).values_list(
                    'user_id', flat=True
                )
                allowed_student_ids = set(filtered_students)

            msgs = (
                Message.objects.select_related('sender', 'receiver')
                .filter(
                    (Q(sender=request.user) & Q(receiver_id__in=list(allowed_student_ids)))
                    | (Q(receiver=request.user) & Q(sender_id__in=list(allowed_student_ids)))
                )
                .order_by('-created_at')
            )
        else:
            from students.utils import get_requested_student
            sp = get_requested_student(request)
            target_user = sp.user if sp else request.user
            allowed_teacher_ids = _student_allowed_teacher_ids(target_user.id)
            msgs = (
                Message.objects.select_related('sender', 'receiver')
                .filter(
                    (Q(sender=target_user) & Q(receiver_id__in=list(allowed_teacher_ids)))
                    | (Q(receiver=target_user) & Q(sender_id__in=list(allowed_teacher_ids)))
                )
                .order_by('-created_at')
            )

        threads_map = {}
        for m in msgs:
            other = m.receiver if m.sender_id == request.user.id else m.sender
            if other.id not in threads_map:
                threads_map[other.id] = {
                    'user_id': other.id,
                    'user_name': other.name or other.username,
                    'user_role': other.role,
                    'last_message_preview': (m.content or '[Attachment]').strip()[:120],
                    'last_message_at': m.created_at,
                    'unread_count': 0,
                    'class_name': None,
                    'section_name': None,
                }
            if m.receiver_id == request.user.id and not m.is_read:
                threads_map[other.id]['unread_count'] += 1

        # Attach class/section details for student participant.
        student_ids = [uid for uid, t in threads_map.items() if t['user_role'] == 'student']
        if student_ids:
            student_profiles = StudentProfile.objects.select_related('class_section__class_ref', 'class_section__section_ref').filter(user_id__in=student_ids)
            for sp in student_profiles:
                t = threads_map.get(sp.user_id)
                if not t:
                    continue
                t['class_name'] = sp.class_section.class_ref.name if sp.class_section else None
                t['section_name'] = sp.class_section.section_ref.name if sp.class_section else None

        threads = list(threads_map.values())
        if unread_only:
            threads = [t for t in threads if t['unread_count'] > 0]
        threads.sort(key=lambda t: t['last_message_at'], reverse=True)
        return Response(threads)


class ConversationView(views.APIView):
    """
    GET: full conversation with one allowed user.
    POST: send message (+ optional attachment).
    """

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, other_user_id: int):
        from students.utils import get_requested_student
        sp = get_requested_student(request)
        target_user = sp.user if sp else request.user
        
        if not _is_allowed_pair(target_user, other_user_id):
            return Response({'error': 'Not allowed for this user'}, status=status.HTTP_403_FORBIDDEN)

        qs = (
            Message.objects.select_related('sender', 'receiver')
            .filter(
                (Q(sender_id=target_user.id) & Q(receiver_id=other_user_id))
                | (Q(sender_id=other_user_id) & Q(receiver_id=target_user.id))
            )
            .order_by('created_at')
        )

        # Mark incoming messages as read.
        Message.objects.filter(sender_id=other_user_id, receiver_id=target_user.id, is_read=False).update(is_read=True)

        return Response(MessageSerializer(qs, many=True).data)

    def post(self, request, other_user_id: int):
        from students.utils import get_requested_student
        sp = get_requested_student(request)
        target_user = sp.user if sp else request.user
        
        if not _is_allowed_pair(target_user, other_user_id):
            return Response({'error': 'Not allowed for this user'}, status=status.HTTP_403_FORBIDDEN)

        content = (request.data.get('content') or '').strip()
        attachment = request.data.get('attachment')
        if not content and not attachment:
            return Response({'error': 'Message content or attachment is required'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = MessageSerializer(data={'content': content, 'attachment': attachment})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        msg = serializer.save(sender=target_user, receiver_id=other_user_id, is_read=False)
        return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)

class DoubtConversationListView(views.APIView):
    """
    List conversations.
    - Students: see their own conversations.
    - Teachers: see conversations with them (filterable by class_section_id).
    - Admins: see all conversations.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role == 'student':
            from students.utils import get_requested_student
            sp = get_requested_student(request)
            qs = Conversation.objects.filter(student=sp)
        elif request.user.role == 'teacher':
            qs = Conversation.objects.filter(teacher=request.user.teacher_profile)
            class_section_id = request.query_params.get('class_section_id')
            if class_section_id:
                qs = qs.filter(student__class_section_id=class_section_id)
        elif request.user.role == 'admin' or request.user.is_superuser:
            qs = Conversation.objects.all()
            if not request.user.is_superuser and getattr(request.user, 'school', None):
                qs = qs.filter(student__school=request.user.school)
            class_section_id = request.query_params.get('class_section_id')
            if class_section_id:
                qs = qs.filter(student__class_section_id=class_section_id)
        else:
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

        # Filters
        subject = request.query_params.get('subject')
        if subject:
            qs = qs.filter(subject__icontains=subject)
        
        status_filter = request.query_params.get('status')
        if status_filter == 'active':
            qs = qs.filter(is_active=True)
        elif status_filter == 'resolved':
            qs = qs.filter(is_active=False)

        qs = qs.order_by('-created_at')
        serializer = ConversationSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        """
        Student starts a new doubt conversation.
        """
        if request.user.role != 'student':
            return Response({'error': 'Only students can start doubts'}, status=status.HTTP_403_FORBIDDEN)
        
        from students.utils import get_requested_student
        sp = get_requested_student(request)
        
        teacher_id = request.data.get('teacher_id')
        subject = request.data.get('subject')
        message_text = request.data.get('message')
        attachment = request.FILES.get('attachment')

        if not teacher_id:
            return Response({'error': 'teacher_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            teacher_profile = TeacherProfile.objects.get(id=teacher_id)
        except TeacherProfile.DoesNotExist:
            return Response({'error': 'Teacher not found'}, status=status.HTTP_404_NOT_FOUND)

        conv = Conversation.objects.create(
            student=sp,
            teacher=teacher_profile,
            subject=subject
        )

        if message_text or attachment:
            Message.objects.create(
                conversation=conv,
                sender=sp.user,
                receiver=teacher_profile.user,
                content=message_text,
                attachment=attachment
            )
            
            # Notify teacher
            Notification.objects.create(
                user=teacher_profile.user,
                target_role='teacher',
                title='New Doubt',
                message=f'Student {sp.user.name or sp.user.username} sent a doubt: {subject or "No Subject"}'
            )

        return Response(ConversationSerializer(conv, context={'request': request}).data, status=status.HTTP_201_CREATED)

class DoubtConversationDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, conversation_id):
        conv = Conversation.objects.filter(id=conversation_id).first()
        if not conv:
            return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check permission
        if request.user.role == 'student':
            from students.utils import get_requested_student
            sp = get_requested_student(request)
            if conv.student_id != sp.id:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        if request.user.role == 'teacher' and conv.teacher.user_id != request.user.id:
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        if (request.user.role == 'admin' or request.user.role == 'school_admin') and not request.user.is_superuser:
            if getattr(request.user, 'school', None) and conv.student.school != request.user.school:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        messages = conv.messages.all().order_by('created_at')
        
        # Mark as read
        conv.messages.filter(receiver=request.user, is_read=False).update(is_read=True)
        
        return Response({
            'conversation': ConversationSerializer(conv, context={'request': request}).data,
            'messages': MessageSerializer(messages, many=True).data
        })

    def post(self, request, conversation_id):
        conv = Conversation.objects.filter(id=conversation_id).first()
        if not conv:
            return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)

        content = request.data.get('content')
        attachment = request.FILES.get('attachment')

        if not content and not attachment:
            return Response({'error': 'Content or attachment required'}, status=status.HTTP_400_BAD_REQUEST)

        target_user = request.user
        if request.user.role == 'student':
            from students.utils import get_requested_student
            sp = get_requested_student(request)
            target_user = sp.user if sp else request.user

        receiver = conv.teacher.user if request.user.role == 'student' else conv.student.user
        
        msg = Message.objects.create(
            conversation=conv,
            sender=target_user,
            receiver=receiver,
            content=content,
            attachment=attachment
        )

        # Notify receiver
        Notification.objects.create(
            user=receiver,
            target_role=receiver.role,
            title='New Message' if request.user.role == 'teacher' else 'Student Reply',
            message=f'New message in doubt chat: {conv.subject or "General"}'
        )

        return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)

class MarkResolvedView(views.APIView):
    permission_classes = [IsTeacher]

    def post(self, request, conversation_id):
        conv = Conversation.objects.filter(id=conversation_id, teacher=request.user.teacher_profile).first()
        if not conv:
            return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)
        
        conv.is_active = False
        conv.save()
        return Response({'message': 'Conversation marked as resolved'})

class DoubtMessageDetailView(views.APIView):
    """
    Handle Edit/Delete of individual messages in the Doubt system.
    Only the sender of the message can perform these actions.
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, message_id):
        target_user = request.user
        if request.user.role == 'student':
            from students.utils import get_requested_student
            sp = get_requested_student(request)
            target_user = sp.user if sp else request.user
            
        msg = Message.objects.filter(id=message_id, sender=target_user).first()
        if not msg:
            return Response({'error': 'Message not found or you are not the sender'}, status=status.HTTP_404_NOT_FOUND)
        
        content = request.data.get('content')
        if not content:
            return Response({'error': 'Content is required to edit'}, status=status.HTTP_400_BAD_REQUEST)
            
        msg.content = content
        msg.save()
        return Response(MessageSerializer(msg).data)

    def delete(self, request, message_id):
        target_user = request.user
        if request.user.role == 'student':
            from students.utils import get_requested_student
            sp = get_requested_student(request)
            target_user = sp.user if sp else request.user

        msg = Message.objects.filter(id=message_id, sender=target_user).first()
        if not msg:
            return Response({'error': 'Message not found or you are not the sender'}, status=status.HTTP_404_NOT_FOUND)
        
        msg.delete()
        return Response({'message': 'Message deleted successfully'}, status=status.HTTP_200_OK)


