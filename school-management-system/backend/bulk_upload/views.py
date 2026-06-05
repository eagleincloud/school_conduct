from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin
from .services import BulkImportService
from .models import BulkImportLog

class ValidateUploadAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        if 'file' not in request.FILES:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)
        
        file_obj = request.FILES['file']
        import_type = request.data.get('type')
        school = request.user.school
        
        if import_type not in ['student', 'teacher']:
            return Response({"error": "Invalid import type. Must be 'student' or 'teacher'."}, status=status.HTTP_400_BAD_REQUEST)

        valid_rows, error_rows = BulkImportService.validate_file(file_obj, import_type, school)
        
        if valid_rows is None:
            return Response({"error_rows": error_rows}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "valid_rows": valid_rows,
            "error_rows": error_rows
        }, status=status.HTTP_200_OK)


class ConfirmImportAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        valid_data = request.data.get('data', [])
        import_type = request.data.get('type')
        file_name = request.data.get('file_name', 'Unknown')
        school = request.user.school

        if import_type not in ['student', 'teacher']:
            return Response({"error": "Invalid import type"}, status=status.HTTP_400_BAD_REQUEST)

        if not valid_data:
            return Response({"error": "No valid data to import"}, status=status.HTTP_400_BAD_REQUEST)

        success_count, failed_count, created_users = BulkImportService.confirm_import(valid_data, import_type, school)
        
        # Log to DB
        log_entry = BulkImportLog.objects.create(
            file_name=file_name,
            uploaded_by=request.user,
            school=school,
            import_type=import_type,
            total_rows=len(valid_data),
            success_count=success_count,
            failed_count=failed_count
        )
        if created_users:
            log_entry.imported_users.add(*created_users)

        return Response({
            "success_count": success_count,
            "failed_count": failed_count
        }, status=status.HTTP_200_OK)


class HistoryAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        logs = BulkImportLog.objects.filter(school=request.user.school).order_by('-created_at')[:20]
        data = []
        for log in logs:
            data.append({
                "id": log.id,
                "file_name": log.file_name,
                "import_type": log.import_type,
                "total_rows": log.total_rows,
                "success_count": log.success_count,
                "failed_count": log.failed_count,
                "created_at": log.created_at
            })
        return Response(data, status=status.HTTP_200_OK)

    def delete(self, request, log_id):
        school = request.user.school
        try:
            log = BulkImportLog.objects.get(id=log_id, school=school)
        except BulkImportLog.DoesNotExist:
            return Response({"error": "Log not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)

        # Delete all imported users associated with this log.
        # This will cascade delete their StudentProfile/TeacherProfile.
        imported_users_batch = log.imported_users.all()
        deleted_count = imported_users_batch.count()
        imported_users_batch.delete()
        
        # Delete the log itself to clean up the history
        log.delete()

        return Response({"message": f"Successfully rolled back {deleted_count} imported users."}, status=status.HTTP_200_OK)
