import mimetypes
import os

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status, views, permissions
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .models import GalleryImage


def _can_view_gallery(user):
    return user.is_authenticated and (user.role in {'admin', 'teacher', 'student'} or user.is_superuser)


def _is_admin(user):
    return user.is_authenticated and (user.role == 'admin' or user.is_superuser)


class GalleryListCreateView(views.APIView):
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        if not _can_view_gallery(request.user):
            return Response({'error': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)

        # 🔒 Data Isolation: Only show images belonging to the user's school.
        # Superadmins and Dealers retain global visibility if they have no school context.
        qs = GalleryImage.objects.select_related('uploaded_by', 'school').order_by('-created_at')
        if not (request.user.is_superuser or request.user.role in ['superadmin', 'dealer']):
            qs = qs.filter(school=request.user.school)
        
        rows = qs.all()
        return Response(
            [
                {
                    'id': img.id,
                    'title': img.title,
                    'image_url': request.build_absolute_uri(f'/api/gallery/{img.id}/image/'),
                    'created_at': img.created_at,
                    'uploaded_by': img.uploaded_by.username,
                    'school_name': img.school.name if img.school else 'Global',
                }
                for img in rows
            ]
        )

    def post(self, request):
        if not _is_admin(request.user):
            return Response({'error': 'Only admin can upload images'}, status=status.HTTP_403_FORBIDDEN)

        title_preset = str(request.data.get('title', '')).strip()
        images = request.FILES.getlist('images') or request.FILES.getlist('image')
        
        if not images:
            image_single = request.FILES.get('image') or request.FILES.get('images')
            if image_single:
                images = [image_single]

        if not images:
            return Response({'error': 'At least one image is required'}, status=status.HTTP_400_BAD_REQUEST)

        created_objects = []
        errors = []

        for image in images:
            # Basic validation
            ext = os.path.splitext(image.name or '')[1].lower()
            if ext not in {'.jpg', '.jpeg', '.png', '.webp', '.gif'}:
                errors.append(f"Invalid format for {image.name}. Only JPG, PNG, WEBP, GIF allowed.")
                continue
            
            if getattr(image, 'size', 0) > (10 * 1024 * 1024):
                errors.append(f"{image.name} is too large (>10MB).")
                continue

            # Fallback title logic
            current_title = title_preset
            if not current_title:
                fname = os.path.splitext(image.name)[0]
                current_title = fname.replace('_', ' ').replace('-', ' ').title()

            try:
                obj = GalleryImage.objects.create(
                    title=current_title,
                    image=image,
                    uploaded_by=request.user,
                    school=request.user.school # 🔒 Automatically isolate to user's school
                )
                created_objects.append({
                    'id': obj.id,
                    'title': obj.title,
                    'image_url': request.build_absolute_uri(f'/api/gallery/{obj.id}/image/'),
                    'created_at': obj.created_at,
                })
            except Exception as e:
                errors.append(f"Failed to save {image.name}: {str(e)}")

        if not created_objects and errors:
            return Response({'error': errors[0], 'details': errors}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                'message': f'Successfully uploaded {len(created_objects)} images.',
                'uploaded': created_objects,
                'errors': errors
            },
            status=status.HTTP_201_CREATED,
        )


class GalleryDeleteView(views.APIView):
    def delete(self, request, image_id: int):
        if not _is_admin(request.user):
            return Response({'error': 'Only admin can delete images'}, status=status.HTTP_403_FORBIDDEN)

        # 🔒 Ensure the image belongs to the user's school before deletion
        qs = GalleryImage.objects.all()
        if not (request.user.is_superuser or request.user.role in ['superadmin', 'dealer']):
            qs = qs.filter(school=request.user.school)
            
        obj = get_object_or_404(qs, id=image_id)
        if obj.image:
            obj.image.delete(save=False)
        obj.delete()
        return Response({'message': 'Deleted successfully'}, status=status.HTTP_200_OK)


class GalleryImageProtectedView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, image_id: int):
        # Support token in query params for <img> tags that can't send headers
        token = request.query_params.get('token')
        if token and not request.user.is_authenticated:
            try:
                from rest_framework_simplejwt.authentication import JWTAuthentication
                auth = JWTAuthentication()
                validated_token = auth.get_validated_token(token)
                request.user = auth.get_user(validated_token)
                print(f"DEBUG [Gallery]: Authenticated user {request.user} ({request.user.role}) via token")
            except Exception as e:
                print(f"DEBUG [Gallery]: Token auth failed for image {image_id}: {str(e)}")

        # 🔒 Data isolation check
        user = request.user
        qs = GalleryImage.objects.all()
        
        # Check privileges (Superadmin/Dealer/Superuser)
        is_privileged = user.is_authenticated and (
            user.is_superuser or 
            getattr(user, 'role', None) in ['superadmin', 'dealer']
        )

        if not is_privileged:
            if not user.is_authenticated:
                print(f"DEBUG [Gallery]: Anonymous access denied for image {image_id}")
                return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
            
            user_school = getattr(user, 'school', None)
            if not user_school:
                print(f"DEBUG [Gallery]: User {user.username} has no school assigned")
                return Response({'error': 'No school assigned to user'}, status=status.HTTP_403_FORBIDDEN)
            
            # Filter specifically for this user's school
            qs = qs.filter(school=user_school)

        try:
            obj = qs.get(id=image_id)
        except GalleryImage.DoesNotExist:
            print(f"DEBUG [Gallery]: Image {image_id} not found or not authorized for school {getattr(user, 'school', 'N/A')}")
            return Response({'error': 'Image not found or unauthorized'}, status=status.HTTP_404_NOT_FOUND)

        if not obj.image:
            return Response({'error': 'No image file associated with this record'}, status=status.HTTP_404_NOT_FOUND)

        file_path = obj.image.path
        if not os.path.exists(file_path):
            print(f"DEBUG [Gallery]: Physical file missing at {file_path}")
            return Response({'error': 'Physical image file missing on server'}, status=status.HTTP_404_NOT_FOUND)

        content_type = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
        response = FileResponse(open(file_path, 'rb'), content_type=content_type)
        response['Content-Disposition'] = f'inline; filename="{obj.filename()}"'
        response['X-Content-Type-Options'] = 'nosniff'
        response['Cache-Control'] = 'private, max-age=3600'
        return response

