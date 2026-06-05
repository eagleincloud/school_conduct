from rest_framework import serializers
from .models import Notification, Message, Conversation


class NotificationSerializer(serializers.ModelSerializer):
    announcement_type = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id',
            'user',
            'target_role',
            'title',
            'message',
            'is_read',
            'related_exam',
            'related_announcement',
            'announcement_type',
            'created_at',
        ]

    def get_announcement_type(self, obj):
        rid = getattr(obj, 'related_announcement_id', None)
        if not rid:
            return None
        try:
            ann = obj.related_announcement
            return ann.type if ann else None
        except Exception:
            return None


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    receiver_name = serializers.SerializerMethodField()
    sender_role = serializers.CharField(source='sender.role', read_only=True)
    receiver_role = serializers.CharField(source='receiver.role', read_only=True)
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id',
            'conversation',
            'sender',
            'sender_name',
            'sender_role',
            'receiver',
            'receiver_name',
            'receiver_role',
            'content',
            'attachment',
            'attachment_url',
            'is_read',
            'created_at',
        ]
        read_only_fields = ['sender', 'receiver', 'is_read', 'created_at', 'attachment_url']


    def get_sender_name(self, obj):
        return obj.sender.name or obj.sender.username

    def get_receiver_name(self, obj):
        return obj.receiver.name or obj.receiver.username

    def get_attachment_url(self, obj):
        if obj.attachment:
            return obj.attachment.url
        return None

    def validate_attachment(self, file_obj):
        if not file_obj:
            return file_obj
        name = (file_obj.name or '').lower()
        allowed = ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf')
        if not name.endswith(allowed):
            raise serializers.ValidationError('Only images and PDF files are allowed')
        if file_obj.size > 10 * 1024 * 1024:
            raise serializers.ValidationError('Attachment size must be <= 10 MB')
        return file_obj

class ConversationSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.name', read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id',
            'student',
            'student_name',
            'teacher',
            'teacher_name',
            'subject',
            'is_active',
            'created_at',
            'last_message',
            'unread_count',
        ]

    def get_last_message(self, obj):
        last = obj.messages.order_by('-created_at').first()
        if last:
            return {
                'content': last.content,
                'created_at': last.created_at,
                'sender_id': last.sender_id
            }
        return None

    def get_unread_count(self, obj):
        user = self.context.get('request').user
        return obj.messages.filter(receiver=user, is_read=False).count()

