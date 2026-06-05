import logging
from typing import Optional

from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status, views
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from accounts.models import User
from classes.models import MainClass
from communication.models import Notification
from students.models import StudentProfile
from teachers.models import TeacherProfile
from tenants.models import School

from .models import Announcement
from .serializers import AnnouncementSerializer

logger = logging.getLogger(__name__)


def _single_active_school_id() -> Optional[int]:
    active = list(School.objects.filter(is_active=True).values_list('pk', flat=True))
    return active[0] if len(active) == 1 else None


def _user_ids_for_role_and_school(role: str, school_pk: int) -> list[int]:
    """
    Match User.role and school. If there is exactly one active school and it equals school_pk,
    also include users with school_id NULL (common in dev / legacy rows).
    """
    qs = User.objects.filter(role=role, school_id=school_pk)
    only = _single_active_school_id()
    if only is not None and only == school_pk:
        qs = User.objects.filter(role=role).filter(Q(school_id=school_pk) | Q(school_id__isnull=True))
    return list(qs.values_list('id', flat=True))


def _announcement_school_pk(announcement) -> Optional[int]:
    """School FK id on tenants.School (same as User.school_id)."""
    if announcement.school_id:
        return announcement.school_id
    if announcement.class_ref_id:
        sid = (
            MainClass.objects.filter(pk=announcement.class_ref_id)
            .values_list('school_id', flat=True)
            .first()
        )
        if sid:
            return sid
    # Dev / misconfigured rows: single active school in DB
    active = School.objects.filter(is_active=True).values_list('pk', flat=True)
    active_list = list(active)
    if len(active_list) == 1:
        return active_list[0]
    return None


def _recipient_user_ids(announcement) -> list:
    school_pk = _announcement_school_pk(announcement)
    aud = announcement.target_audience
    ids: list[int] = []

    if aud in (Announcement.AUDIENCE_ALL, Announcement.AUDIENCE_STUDENTS):
        if announcement.class_ref_id:
            qs = StudentProfile.objects.filter(class_section__class_ref_id=announcement.class_ref_id)
            if school_pk:
                qs = qs.filter(
                    Q(user__school_id=school_pk)
                    | Q(class_section__school_id=school_pk)
                    | Q(class_section__school_id__isnull=True)
                )
            ids.extend(qs.values_list('user_id', flat=True))
        elif school_pk:
            stud_q = Q(user__school_id=school_pk) | Q(class_section__school_id=school_pk)
            if _single_active_school_id() == school_pk:
                stud_q |= Q(user__school_id__isnull=True)
            qs = StudentProfile.objects.filter(stud_q)
            ids.extend(qs.values_list('user_id', flat=True))
            ids.extend(_user_ids_for_role_and_school('student', school_pk))
        else:
            logger.warning(
                'announcement_notify_no_students ann_id=%s (need school or class)',
                getattr(announcement, 'pk', None),
            )

    if aud in (Announcement.AUDIENCE_ALL, Announcement.AUDIENCE_TEACHERS):
        if school_pk:
            teach_q = (
                Q(user__school_id=school_pk)
                | Q(managed_class__school_id=school_pk)
                | Q(assigned_subjects__class_section__school_id=school_pk)
            )
            qs = TeacherProfile.objects.filter(teach_q).distinct()
            ids.extend(qs.values_list('user_id', flat=True))
            ids.extend(_user_ids_for_role_and_school('teacher', school_pk))
        elif announcement.class_ref_id:
            tq = Q(assigned_subjects__class_section__class_ref_id=announcement.class_ref_id) | Q(
                managed_class__class_ref_id=announcement.class_ref_id
            )
            ids.extend(
                TeacherProfile.objects.filter(tq).distinct().values_list('user_id', flat=True)
            )
        else:
            logger.warning(
                'announcement_notify_no_teachers ann_id=%s (need school or class for teachers)',
                getattr(announcement, 'pk', None),
            )

    out = list({i for i in ids if i})

    # Broad fallback: profile graph often empty in real data (null school on User/Section).
    spk = school_pk
    if not spk:
        active = list(School.objects.filter(is_active=True).values_list('pk', flat=True))
        if len(active) == 1:
            spk = active[0]

    if not out and spk:
        if aud == Announcement.AUDIENCE_STUDENTS:
            out.extend(_user_ids_for_role_and_school('student', spk))
        elif aud == Announcement.AUDIENCE_TEACHERS:
            out.extend(_user_ids_for_role_and_school('teacher', spk))
        elif aud == Announcement.AUDIENCE_ALL:
            out.extend(_user_ids_for_role_and_school('student', spk))
            out.extend(_user_ids_for_role_and_school('teacher', spk))
        if out:
            logger.warning(
                'announcement_notify_used_role_fallback ann_id=%s school_pk=%s count=%s',
                getattr(announcement, 'pk', None),
                spk,
                len(out),
            )

    return list({i for i in out if i})


def _notify_recipients(announcement) -> int:
    """Create Notification rows; returns count sent, or 0 if skipped / failed."""
    user_ids = _recipient_user_ids(announcement)
    if not user_ids:
        logger.warning(
            'announcement_notify_zero_recipients announcement_id=%s audience=%s school_pk=%s class_ref=%s',
            getattr(announcement, 'pk', None),
            getattr(announcement, 'target_audience', ''),
            _announcement_school_pk(announcement),
            getattr(announcement, 'class_ref_id', None),
        )
        return 0
    valid_ids = list(User.objects.filter(id__in=user_ids).values_list('id', flat=True))
    if len(valid_ids) < len(user_ids):
        logger.warning(
            'announcement_notify_skipped_invalid_user_ids ann=%s asked=%s valid=%s',
            announcement.pk,
            len(user_ids),
            len(valid_ids),
        )
    if not valid_ids:
        return 0
    if announcement.type == Announcement.TYPE_HOLIDAY:
        msg = (
            f'📢 New Holiday Announcement: School will be closed from {announcement.start_date} to {announcement.end_date}'
        )
    else:
        msg = (
            f'📢 New {announcement.get_type_display()} announcement: {announcement.title} '
            f'({announcement.start_date} to {announcement.end_date})'
        )
    title = f'Announcement: {announcement.title}'[:255]

    role_by_id = dict(User.objects.filter(id__in=valid_ids).values_list('id', 'role'))
    created = 0
    for uid in valid_ids:
        target_role = role_by_id.get(uid) or 'student'
        try:
            Notification.objects.create(
                user_id=uid,
                target_role=target_role,
                title=title,
                message=msg,
                is_read=False,
                related_announcement=announcement,
            )
            created += 1
        except Exception:
            try:
                Notification.objects.create(
                    user_id=uid,
                    target_role=target_role,
                    title=title,
                    message=msg,
                    is_read=False,
                )
                created += 1
            except Exception:
                logger.exception(
                    'announcement_notify row failed user=%s announcement=%s',
                    uid,
                    announcement.pk,
                )

    logger.info('announcement_notify_done announcement_id=%s created=%s', announcement.pk, created)
    return created


def _base_queryset():
    return Announcement.objects.select_related('class_ref', 'created_by')


def _scoped_queryset(request):
    qs = _base_queryset()
    user = request.user
    if user.is_superuser:
        return qs
    if user.school_id:
        return qs.filter(school_id=user.school_id)
    return qs.none()


def _filter_for_viewer(qs, request, *, active_only: bool):
    user = request.user
    if active_only:
        qs = qs.filter(end_date__gte=timezone.localdate())
    if user.role == 'student':
        from students.utils import get_requested_student
        sp = get_requested_student(request)
        if not sp:
            return qs.none()
        qs = qs.filter(
            Q(target_audience=Announcement.AUDIENCE_ALL) | Q(target_audience=Announcement.AUDIENCE_STUDENTS)
        )
        cid = sp.class_section.class_ref_id if sp.class_section else None
        if cid:
            qs = qs.filter(Q(class_ref__isnull=True) | Q(class_ref_id=cid))
        else:
            qs = qs.filter(class_ref__isnull=True)
    elif user.role == 'teacher':
        qs = qs.filter(
            Q(target_audience=Announcement.AUDIENCE_ALL) | Q(target_audience=Announcement.AUDIENCE_TEACHERS)
        )
    return qs


def _is_admin_like(user):
    return user.role == 'admin' or user.is_superuser


class AnnouncementListCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        qs = _scoped_queryset(request)
        if _is_admin_like(request.user):
            if request.query_params.get('active_only') in ('1', 'true', 'yes'):
                qs = qs.filter(end_date__gte=timezone.localdate())
        else:
            qs = _filter_for_viewer(qs, request, active_only=True)

        t = request.query_params.get('type')
        if t in ('holiday', 'exam', 'general'):
            qs = qs.filter(type=t)
        search = request.query_params.get('search')
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))
        qs = qs.order_by('-is_pinned', '-is_important', '-created_at')
        ser = AnnouncementSerializer(qs, many=True, context={'request': request})
        return Response(ser.data)

    def post(self, request):
        if not _is_admin_like(request.user):
            return Response({'error': 'Only admin can create announcements'}, status=status.HTTP_403_FORBIDDEN)
        ser = AnnouncementSerializer(data=request.data, context={'request': request})
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        ann = ser.save()
        ann = Announcement.objects.select_related('school', 'class_ref', 'class_ref__school').get(pk=ann.pk)
        n_sent = _notify_recipients(ann)
        payload = dict(AnnouncementSerializer(ann, context={'request': request}).data)
        payload['notifications_sent'] = n_sent
        if n_sent == 0:
            payload['notifications_warning'] = (
                'No notifications were created. Ensure this announcement has a school (or a class with a school) '
                'and that students/teachers exist for that school. Run: python manage.py migrate communication'
            )
        return Response(payload, status=status.HTTP_201_CREATED)


class AnnouncementDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, pk: int):
        qs = _scoped_queryset(request).filter(pk=pk)
        if _is_admin_like(request.user):
            ann = qs.first()
        else:
            ann = _filter_for_viewer(qs, request, active_only=True).first()
        if not ann:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AnnouncementSerializer(ann, context={'request': request}).data)

    def patch(self, request, pk: int):
        if not _is_admin_like(request.user):
            return Response({'error': 'Only admin can update announcements'}, status=status.HTTP_403_FORBIDDEN)
        ann = _scoped_queryset(request).filter(pk=pk).first()
        if not ann:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        ser = AnnouncementSerializer(ann, data=request.data, partial=True, context={'request': request})
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        ann = ser.save()
        return Response(AnnouncementSerializer(ann, context={'request': request}).data)

    def delete(self, request, pk: int):
        if not _is_admin_like(request.user):
            return Response({'error': 'Only admin can delete announcements'}, status=status.HTTP_403_FORBIDDEN)
        ann = _scoped_queryset(request).filter(pk=pk).first()
        if not ann:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        ann.delete()
        return Response({'message': 'Deleted'}, status=status.HTTP_200_OK)


class AnnouncementNotifyView(views.APIView):
    """Admin: create notification rows for an existing announcement (e.g. after fixing data or recipients)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: int):
        if not _is_admin_like(request.user):
            return Response({'error': 'Only admin can notify'}, status=status.HTTP_403_FORBIDDEN)
        ann = _scoped_queryset(request).filter(pk=pk).first()
        if not ann:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        ann = Announcement.objects.select_related('school', 'class_ref', 'class_ref__school').get(pk=ann.pk)
        n_sent = _notify_recipients(ann)
        payload = {'notifications_sent': n_sent}
        if n_sent == 0:
            payload['notifications_warning'] = (
                'No notifications were created. Check school/class on the announcement and user school_id. '
                'Run: python manage.py migrate communication'
            )
        return Response(payload, status=status.HTTP_200_OK)
