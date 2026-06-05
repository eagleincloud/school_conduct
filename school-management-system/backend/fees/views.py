import csv
import re
from decimal import Decimal, InvalidOperation
from io import BytesIO

from django.http import HttpResponse
from django.db import transaction
from django.db.utils import OperationalError, ProgrammingError
from django.utils import timezone
from django.db.models import Sum
from django.db.models.functions import ExtractMonth
from rest_framework import status, views
from rest_framework.response import Response

from core.permissions import IsStudent, IsAdmin
from students.models import StudentProfile
from students.utils import get_requested_student
from .models import ClassFeeCard, ClassFeeCardRollback, FeeStructure, StudentFee, Payment
from .serializers import (
    ClassFeeCardSerializer,
    FeeStructureSerializer,
    StudentFeeSerializer,
    StudentFeeListSerializer,
    PaymentSerializer,
)
from .pdf_receipt import build_payment_receipt_pdf


def _clean_decimal(value):
    """Accept values like 1200, 1,200, ₹1200.00, or empty."""
    if value is None:
        return Decimal('0.00')
    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))
    text = str(value).strip()
    if not text:
        return Decimal('0.00')
    text = text.replace('₹', '').replace(',', '').strip()
    if text.lower() in {'na', 'n/a', '-', '--'}:
        return Decimal('0.00')
    try:
        return Decimal(text)
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f"Invalid decimal value: {value}")


def _create_fee_card_snapshot(school, user, source='manual'):
    try:
        rows = ClassFeeCard.objects.filter(school=school).order_by('id')
        snapshot = [
            {
                'class_name': row.class_name,
                'registration_fee': str(row.registration_fee),
                'admission_fee': str(row.admission_fee),
                'tuition_fee': str(row.tuition_fee),
                'computer_fee': str(row.computer_fee),
                'annual_charges': str(row.annual_charges),
                'science_fee': str(row.science_fee),
                'sports_fee': str(row.sports_fee),
            }
            for row in rows
        ]
        ClassFeeCardRollback.objects.create(
            school=school,
            created_by=user,
            source=source,
            snapshot=snapshot,
        )
    except (ProgrammingError, OperationalError):
        # Rollback table may be missing before migrations; avoid breaking normal flows.
        return


class MyFeesView(views.APIView):
    permission_classes = [IsStudent]

    def get(self, request):
        student = get_requested_student(request)
        if not student:
            return Response({'error': 'Student profile not found'}, status=status.HTTP_404_NOT_FOUND)

        if student.class_section:
            structure = FeeStructure.objects.filter(class_ref_id=student.class_section.class_ref_id).first()
            if structure:
                sf, _ = StudentFee.objects.get_or_create(
                    student=student,
                    fee_structure=structure,
                    defaults={'due_date': structure.due_date},
                )
                if sf.due_date != structure.due_date:
                    sf.due_date = structure.due_date
                    sf.save(update_fields=['due_date'])

        fees = (
            StudentFee.objects.filter(student=student)
            .select_related('student__user', 'student__class_section__class_ref', 'student__class_section__section_ref', 'fee_structure')
            .prefetch_related('payments')
        )
        return Response(StudentFeeSerializer(fees, many=True).data)


class AdminClassFeeCardListCreateView(views.APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        school = request.user.school
        qs = ClassFeeCard.objects.all()
        if not request.user.is_superuser:
            qs = qs.filter(school=school)
        return Response(ClassFeeCardSerializer(qs.order_by('class_name'), many=True).data)

    def post(self, request):
        school = request.user.school
        ser = ClassFeeCardSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        _create_fee_card_snapshot(school, request.user, source='single_create')
        card = ser.save(school=school, created_by=request.user)
        return Response(ClassFeeCardSerializer(card).data, status=status.HTTP_201_CREATED)


class AdminClassFeeCardDetailView(views.APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, pk: int):
        school = request.user.school
        qs = ClassFeeCard.objects.filter(pk=pk)
        if not request.user.is_superuser:
            qs = qs.filter(school=school)
        obj = qs.first()
        if not obj:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        ser = ClassFeeCardSerializer(obj, data=request.data, partial=True)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        _create_fee_card_snapshot(school, request.user, source='single_update')
        ser.save()
        return Response(ser.data)

    def delete(self, request, pk: int):
        school = request.user.school
        qs = ClassFeeCard.objects.filter(pk=pk)
        if not request.user.is_superuser:
            qs = qs.filter(school=school)
        obj = qs.first()
        if not obj:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        _create_fee_card_snapshot(school, request.user, source='single_delete')
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminClassFeeCardBulkUpsertView(views.APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        school = request.user.school
        cards = request.data.get('cards') or []
        if not isinstance(cards, list) or len(cards) == 0:
            return Response({"error": "cards list is required"}, status=status.HTTP_400_BAD_REQUEST)
        _create_fee_card_snapshot(school, request.user, source='bulk_upload')
        saved = []
        skipped = []
        for idx, row in enumerate(cards, start=1):
            class_name = str(row.get('class_name', '')).strip()
            if not class_name or class_name.lower() == 'class_name':
                continue
            try:
                defaults = {
                    'registration_fee': _clean_decimal(row.get('registration_fee')),
                    'admission_fee': _clean_decimal(row.get('admission_fee')),
                    'tuition_fee': _clean_decimal(row.get('tuition_fee')),
                    'computer_fee': _clean_decimal(row.get('computer_fee')),
                    'annual_charges': _clean_decimal(row.get('annual_charges')),
                    'science_fee': _clean_decimal(row.get('science_fee')),
                    'sports_fee': _clean_decimal(row.get('sports_fee')),
                    'created_by': request.user,
                }
                obj, _ = ClassFeeCard.objects.update_or_create(
                    school=school,
                    class_name=class_name,
                    defaults=defaults,
                )
                saved.append(obj)
            except ValueError as exc:
                skipped.append({"row": idx, "class_name": class_name, "error": str(exc)})
        return Response(
            {
                "message": "Fee cards uploaded successfully",
                "count": len(saved),
                "skipped_count": len(skipped),
                "skipped_rows": skipped[:10],
                "cards": ClassFeeCardSerializer(saved, many=True).data,
            }
        )


class AdminClassFeeCardFileUploadView(views.APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        school = request.user.school
        upload = request.FILES.get('file')
        file_type = str(request.data.get('file_type', '')).strip().lower()
        if not upload:
            return Response({"error": "file is required"}, status=status.HTTP_400_BAD_REQUEST)

        guessed_type = (upload.name.split('.')[-1] if '.' in upload.name else '').lower()
        source_type = file_type or guessed_type
        # If selector and file extension differ, trust the file extension.
        if guessed_type in ('csv', 'pdf'):
            source_type = guessed_type
        if source_type not in ('csv', 'pdf'):
            return Response({"error": "Only csv or pdf supported"}, status=status.HTTP_400_BAD_REQUEST)

        rows = []
        if source_type == 'csv':
            try:
                decoded = upload.read().decode('utf-8')
                reader = csv.DictReader(decoded.splitlines())
                for row in reader:
                    class_name = str(row.get('class_name') or row.get('class') or '').strip()
                    if not class_name:
                        continue
                    rows.append(
                        {
                            'class_name': class_name,
                            'registration_fee': row.get('registration_fee') or row.get('registration') or 0,
                            'admission_fee': row.get('admission_fee') or row.get('admission') or 0,
                            'tuition_fee': row.get('tuition_fee') or row.get('tuition') or 0,
                            'computer_fee': row.get('computer_fee') or row.get('computer') or 0,
                            'annual_charges': row.get('annual_charges') or row.get('annual') or 0,
                            'science_fee': row.get('science_fee') or row.get('science') or 0,
                            'sports_fee': row.get('sports_fee') or row.get('sports') or 0,
                        }
                    )
            except Exception:
                return Response({"error": "Invalid CSV file"}, status=status.HTTP_400_BAD_REQUEST)

        if source_type == 'pdf':
            try:
                from pypdf import PdfReader
            except Exception:
                return Response({"error": "PDF parsing dependency missing (install pypdf)"}, status=status.HTTP_400_BAD_REQUEST)
            try:
                text = ''
                reader = PdfReader(upload)
                for page in reader.pages:
                    text += (page.extract_text() or '') + '\n'
                for raw in text.splitlines():
                    line = ' '.join(raw.split()).strip()
                    if not line:
                        continue
                    nums = re.findall(r'\d+(?:\.\d+)?', line)
                    if len(nums) < 7:
                        continue
                    class_part = re.split(r'\d', line, maxsplit=1)[0].strip(' -:')
                    if not class_part or len(class_part) > 30:
                        continue
                    values = nums[:7]
                    rows.append(
                        {
                            'class_name': class_part,
                            'registration_fee': values[0],
                            'admission_fee': values[1],
                            'tuition_fee': values[2],
                            'computer_fee': values[3],
                            'annual_charges': values[4],
                            'science_fee': values[5],
                            'sports_fee': values[6],
                        }
                    )
            except Exception:
                return Response({"error": "Could not parse PDF. Use CSV format if PDF is scanned image."}, status=status.HTTP_400_BAD_REQUEST)

        if not rows:
            return Response({"error": "No fee rows found in file"}, status=status.HTTP_400_BAD_REQUEST)

        _create_fee_card_snapshot(school, request.user, source='file_upload')
        saved = []
        skipped = []
        for idx, row in enumerate(rows, start=1):
            class_name = str(row.get('class_name', '')).strip()
            if not class_name or class_name.lower() == 'class_name':
                continue
            try:
                defaults = {
                    'registration_fee': _clean_decimal(row.get('registration_fee')),
                    'admission_fee': _clean_decimal(row.get('admission_fee')),
                    'tuition_fee': _clean_decimal(row.get('tuition_fee')),
                    'computer_fee': _clean_decimal(row.get('computer_fee')),
                    'annual_charges': _clean_decimal(row.get('annual_charges')),
                    'science_fee': _clean_decimal(row.get('science_fee')),
                    'sports_fee': _clean_decimal(row.get('sports_fee')),
                    'created_by': request.user,
                }
                obj, _ = ClassFeeCard.objects.update_or_create(
                    school=school,
                    class_name=class_name,
                    defaults=defaults,
                )
                saved.append(obj)
            except ValueError as exc:
                skipped.append({"row": idx, "class_name": class_name, "error": str(exc)})

        return Response(
            {
                "message": "File uploaded successfully",
                "count": len(saved),
                "skipped_count": len(skipped),
                "skipped_rows": skipped[:10],
                "cards": ClassFeeCardSerializer(saved, many=True).data,
            }
        )


class AdminClassFeeCardBootstrapView(views.APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        school = request.user.school
        _create_fee_card_snapshot(school, request.user, source='bootstrap')
        base_classes = ['Nursery', 'LKG', 'UKG'] + [str(i) for i in range(1, 13)]
        created = 0
        for cls in base_classes:
            _, was_created = ClassFeeCard.objects.get_or_create(
                school=school,
                class_name=cls,
                defaults={'created_by': request.user},
            )
            if was_created:
                created += 1
        return Response({"message": "Default class fee cards ready", "created": created, "total": len(base_classes)})


class AdminClassFeeCardRollbackView(views.APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        school = request.user.school
        try:
            rollback = ClassFeeCardRollback.objects.filter(school=school).order_by('-created_at').first()
        except (ProgrammingError, OperationalError):
            return Response(
                {"error": "Rollback table not ready. Run migrations: python manage.py migrate"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not rollback:
            return Response({"error": "No rollback snapshot available"}, status=status.HTTP_400_BAD_REQUEST)

        rows = rollback.snapshot or []
        with transaction.atomic():
            ClassFeeCard.objects.filter(school=school).delete()
            for row in rows:
                ClassFeeCard.objects.create(
                    school=school,
                    created_by=request.user,
                    class_name=str(row.get('class_name', '')).strip(),
                    registration_fee=_clean_decimal(row.get('registration_fee')),
                    admission_fee=_clean_decimal(row.get('admission_fee')),
                    tuition_fee=_clean_decimal(row.get('tuition_fee')),
                    computer_fee=_clean_decimal(row.get('computer_fee')),
                    annual_charges=_clean_decimal(row.get('annual_charges')),
                    science_fee=_clean_decimal(row.get('science_fee')),
                    sports_fee=_clean_decimal(row.get('sports_fee')),
                )
            rollback.delete()

        return Response({"message": "Rollback completed", "restored_count": len(rows)})


class AdminClassFeeCardDeleteAllView(views.APIView):
    permission_classes = [IsAdmin]

    def delete(self, request):
        school = request.user.school
        _create_fee_card_snapshot(school, request.user, source='delete_all')
        deleted, _ = ClassFeeCard.objects.filter(school=school).delete()
        return Response({"message": "All fee cards deleted", "deleted_count": deleted})


class StudentClassFeeCardListView(views.APIView):
    permission_classes = [IsStudent]

    def get(self, request):
        student = get_requested_student(request)
        student_class_name = ''
        if student and student.class_section:
            student_class_name = f"{student.class_section.class_ref.name}-{student.class_section.section_ref.name}"
        
        # We still show all cards for the school, but 'student_class_name' will now be sibling-aware
        school = student.school if student else request.user.school
        qs = ClassFeeCard.objects.filter(school=school).order_by('class_name')
        return Response(
            {
                "student_class_name": student_class_name,
                "cards": ClassFeeCardSerializer(qs, many=True).data,
            }
        )


class FeeStructureListCreateView(views.APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        school = request.user.school
        qs = FeeStructure.objects.select_related('class_ref')
        if not request.user.is_superuser:
            qs = qs.filter(class_ref__school=school)
        qs = qs.order_by('class_ref__name')
        return Response(FeeStructureSerializer(qs, many=True).data)

    def post(self, request):
        school = request.user.school
        ser = FeeStructureSerializer(data=request.data)
        if ser.is_valid():
            class_ref = ser.validated_data.get('class_ref')
            if not request.user.is_superuser and class_ref and class_ref.school != school:
                return Response({'error': 'Not authorized for this class'}, status=status.HTTP_403_FORBIDDEN)
            existing_qs = FeeStructure.objects.filter(class_ref=class_ref)
            if not request.user.is_superuser:
                existing_qs = existing_qs.filter(class_ref__school=school)
            existing = existing_qs.first()

            # Upsert behavior: if class already has structure, update it instead of returning 400.
            if existing:
                update_ser = FeeStructureSerializer(existing, data=request.data, partial=True)
                if not update_ser.is_valid():
                    return Response(update_ser.errors, status=status.HTTP_400_BAD_REQUEST)
                structure = update_ser.save()
                response_status = status.HTTP_200_OK
            else:
                structure = ser.save()
                response_status = status.HTTP_201_CREATED
            
            students = StudentProfile.objects.filter(class_section__class_ref_id=structure.class_ref_id)
            for s in students:
                sf, _ = StudentFee.objects.get_or_create(
                    student=s,
                    fee_structure=structure,
                    defaults={'due_date': structure.due_date},
                )
                if sf.due_date != structure.due_date:
                    sf.due_date = structure.due_date
                    sf.save(update_fields=['due_date'])
            return Response(FeeStructureSerializer(structure).data, status=response_status)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)


class FeeStructureDetailView(views.APIView):
    permission_classes = [IsAdmin]

    def get(self, request, pk: int):
        school = request.user.school
        qs = FeeStructure.objects.select_related('class_ref').filter(pk=pk)
        if not request.user.is_superuser:
            qs = qs.filter(class_ref__school=school)
        obj = qs.first()
        if not obj:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(FeeStructureSerializer(obj).data)

    def patch(self, request, pk: int):
        school = request.user.school
        qs = FeeStructure.objects.filter(pk=pk)
        if not request.user.is_superuser:
            qs = qs.filter(class_ref__school=school)
        obj = qs.first()
        if not obj:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        
        ser = FeeStructureSerializer(obj, data=request.data, partial=True)
        if ser.is_valid():
            class_ref = ser.validated_data.get('class_ref')
            if class_ref and not request.user.is_superuser and class_ref.school != school:
                 return Response({'error': 'Not authorized for this class'}, status=status.HTTP_403_FORBIDDEN)
                 
            ser.save()
            for sf in obj.student_fees.all():
                sf.due_date = obj.due_date
                sf.save(update_fields=['due_date'])
            return Response(ser.data)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk: int):
        school = request.user.school
        qs = FeeStructure.objects.filter(pk=pk)
        if not request.user.is_superuser:
            qs = qs.filter(class_ref__school=school)
        obj = qs.first()
        if not obj:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        force_delete = str(request.query_params.get('force', '')).lower() in ('1', 'true', 'yes')
        if obj.student_fees.exists() and not force_delete:
            return Response(
                {"error": "Fee structure is linked with student records. Retry with force delete."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Cascade delete removes linked StudentFee and Payment rows through FK relations.
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StudentPaymentCreateView(views.APIView):
    permission_classes = [IsStudent]

    def post(self, request):
        student_fee_id = request.data.get('student_fee_id')
        amount = request.data.get('amount')
        payment_date = request.data.get('payment_date')
        payment_mode = request.data.get('payment_mode', 'UPI')
        transaction_id = request.data.get('transaction_id', '')

        if not student_fee_id or amount is None or not payment_date:
            return Response(
                {"error": "student_fee_id, amount, and payment_date are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        student = get_requested_student(request)
        if not student:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        sf = (
            StudentFee.objects.select_related('fee_structure')
            .filter(id=student_fee_id, student=student)
            .first()
        )
        if not sf:
            return Response({"error": "Student fee record not found for the active student"}, status=status.HTTP_404_NOT_FOUND)

        try:
            amount_dec = Decimal(str(amount))
        except Exception:
            return Response({"error": "Invalid amount"}, status=status.HTTP_400_BAD_REQUEST)

        if amount_dec <= 0:
            return Response({"error": "Amount must be positive"}, status=status.HTTP_400_BAD_REQUEST)

        balance = sf.due_amount
        if amount_dec > balance + Decimal('0.009'):
            return Response(
                {"error": f"Amount exceeds due balance (₹{balance})"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pay = Payment.objects.create(
            student_fee=sf,
            amount=amount_dec,
            payment_date=payment_date,
            payment_mode=payment_mode,
            transaction_id=transaction_id or '',
        )
        sf.refresh_from_db()
        return Response(
            {
                'payment': PaymentSerializer(pay).data,
                'student_fee': StudentFeeSerializer(sf).data,
            },
            status=status.HTTP_201_CREATED,
        )

class AdminStudentFeeListView(views.APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        school = request.user.school
        qs = StudentFee.objects.select_related(
            'student__user',
            'student__class_section__class_ref',
            'student__class_section__section_ref',
            'fee_structure',
        ).prefetch_related('payments')

        if not request.user.is_superuser:
            qs = qs.filter(student__user__school=school)

        class_id = request.query_params.get('class_id')
        section_id = request.query_params.get('class_section_id')
        student_id = request.query_params.get('student_id')
        overdue_only = request.query_params.get('overdue_only')

        if class_id:
            qs = qs.filter(student__class_section__class_ref_id=class_id)
        if section_id:
            qs = qs.filter(student__class_section_id=section_id)
        if student_id:
            qs = qs.filter(student_id=student_id)

        qs = qs.order_by('-id')
        if request.query_params.get('full') in ('1', 'true', 'yes'):
            data = StudentFeeSerializer(qs, many=True).data
        else:
            data = StudentFeeListSerializer(qs, many=True).data
        if overdue_only and overdue_only.lower() in ('1', 'true', 'yes'):
            data = [row for row in data if row.get('overdue') and row.get('status') != 'paid']
        return Response(data)


class AdminStudentFeeDetailView(views.APIView):
    permission_classes = [IsAdmin]

    def get(self, request, pk: int):
        school = request.user.school
        qs = (
            StudentFee.objects.select_related(
                'student__user',
                'student__class_section__class_ref',
                'student__class_section__section_ref',
                'fee_structure',
            )
            .prefetch_related('payments')
            .filter(pk=pk)
        )
        if not request.user.is_superuser:
            qs = qs.filter(student__user__school=school)
            
        sf = qs.first()
        if not sf:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(StudentFeeSerializer(sf).data)


class AdminStudentFeeCreateView(views.APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        school = request.user.school
        student_id = request.data.get('student_id')
        if not student_id:
            return Response({"error": "student_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        qs = StudentProfile.objects.select_related('class_section__class_ref').filter(id=student_id)
        if not request.user.is_superuser:
            qs = qs.filter(user__school=school)
            
        student = qs.first()
        if not student or not student.class_section:
            return Response({"error": "Student or class not found"}, status=status.HTTP_400_BAD_REQUEST)
            
        structure = FeeStructure.objects.filter(class_ref_id=student.class_section.class_ref_id).first()
        if not structure:
            return Response(
                {"error": "No fee structure defined for this class"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sf, created = StudentFee.objects.get_or_create(
            student=student,
            fee_structure=structure,
            defaults={'due_date': structure.due_date},
        )
        if not created and sf.due_date != structure.due_date:
            sf.due_date = structure.due_date
            sf.save(update_fields=['due_date'])
        return Response(StudentFeeSerializer(sf).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class AdminSyncClassFeesView(views.APIView):
    """Create StudentFee rows for all students in a MainClass if missing."""

    permission_classes = [IsAdmin]

    def post(self, request):
        school = request.user.school
        class_id = request.data.get('class_id')
        if not class_id:
            return Response({"error": "class_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        qs_structure = FeeStructure.objects.filter(class_ref_id=class_id)
        if not request.user.is_superuser:
            qs_structure = qs_structure.filter(class_ref__school=school)
            
        structure = qs_structure.first()
        if not structure:
            return Response({"error": "Fee structure not found for class or not authorized"}, status=status.HTTP_400_BAD_REQUEST)
            
        qs_students = StudentProfile.objects.filter(class_section__class_ref_id=class_id)
        if not request.user.is_superuser:
            qs_students = qs_students.filter(user__school=school)
            
        students = qs_students.all()
        created = 0
        for s in students:
            _, was_created = StudentFee.objects.get_or_create(
                student=s,
                fee_structure=structure,
                defaults={'due_date': structure.due_date},
            )
            if was_created:
                created += 1
        return Response({"message": "Sync complete", "created": created, "students_checked": students.count()})


class AdminPaymentCreateView(views.APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        school = request.user.school
        student_fee_id = request.data.get('student_fee_id')
        amount = request.data.get('amount')
        payment_date = request.data.get('payment_date')
        payment_mode = request.data.get('payment_mode', 'Cash')
        transaction_id = request.data.get('transaction_id', '')

        if not student_fee_id or amount is None or not payment_date:
            return Response(
                {"error": "student_fee_id, amount, and payment_date are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
            
        qs = StudentFee.objects.select_related('fee_structure').filter(id=student_fee_id)
        if not request.user.is_superuser:
            qs = qs.filter(student__user__school=school)
            
        sf = qs.first()
        if not sf:
            return Response({"error": "Student fee record not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            amount_dec = Decimal(str(amount))
        except Exception:
            return Response({"error": "Invalid amount"}, status=status.HTTP_400_BAD_REQUEST)

        if amount_dec <= 0:
            return Response({"error": "Amount must be positive"}, status=status.HTTP_400_BAD_REQUEST)

        balance = sf.due_amount
        if amount_dec > balance + Decimal('0.009'):
            return Response(
                {"error": f"Amount exceeds due balance (₹{balance})"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pay = Payment.objects.create(
            student_fee=sf,
            amount=amount_dec,
            payment_date=payment_date,
            payment_mode=payment_mode,
            transaction_id=transaction_id or '',
        )
        sf.refresh_from_db()
        return Response(
            {
                'payment': PaymentSerializer(pay).data,
                'student_fee': StudentFeeSerializer(sf).data,
            },
            status=status.HTTP_201_CREATED,
        )


class AdminReceiptPDFView(views.APIView):
    permission_classes = [IsAdmin]

    def get(self, request, payment_id: int):
        school = request.user.school
        qs = (
            Payment.objects.select_related(
                'student_fee__student__user',
                'student_fee__student__class_section__class_ref',
                'student_fee__student__class_section__section_ref',
            )
            .filter(id=payment_id)
        )
        if not request.user.is_superuser:
            qs = qs.filter(student_fee__student__user__school=school)
            
        pay = qs.first()
        if not pay:
            return Response({"error": "Payment not found"}, status=status.HTTP_404_NOT_FOUND)
        pdf_bytes = build_payment_receipt_pdf(pay)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="fee_receipt_{payment_id}.pdf"'
        return response


class StudentReceiptPDFView(views.APIView):
    permission_classes = [IsStudent]

    def get(self, request, payment_id: int):
        student = get_requested_student(request)
        if not student:
             return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        pay = (
            Payment.objects.select_related(
                'student_fee__student__user',
                'student_fee__student__class_section__class_ref',
                'student_fee__student__class_section__section_ref',
            )
            .filter(id=payment_id, student_fee__student=student)
            .first()
        )
        if not pay:
            return Response({"error": "Payment not found"}, status=status.HTTP_404_NOT_FOUND)
        pdf_bytes = build_payment_receipt_pdf(pay)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="fee_receipt_{payment_id}.pdf"'
        return response


class AdminFeesDashboardView(views.APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        school = request.user.school
        today = timezone.now().date()
        qs = StudentFee.objects.select_related('fee_structure')
        if not request.user.is_superuser:
            qs = qs.filter(student__user__school=school)
            
        records = list(qs.all())
        total_scheduled = sum((r.fee_structure.total_fees for r in records), Decimal('0'))
        total_paid = sum((r.amount_paid for r in records), Decimal('0'))
        total_outstanding = sum((r.due_amount for r in records), Decimal('0'))
        overdue_count = sum(
            1 for r in records if r.status != 'paid' and r.due_date < today
        )
        return Response(
            {
                'student_fee_records': len(records),
                'total_fees_scheduled': str(total_scheduled),
                'total_paid': str(total_paid),
                'total_due': str(total_outstanding),
                'overdue_records': overdue_count,
            }
        )


class AdminFeesCollectionView(views.APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        current_year = timezone.now().year
        raw_year = request.query_params.get('year')
        try:
            year = int(raw_year) if raw_year else current_year
        except (TypeError, ValueError):
            return Response({"error": "Invalid year"}, status=status.HTTP_400_BAD_REQUEST)

        school = request.user.school
        qs = Payment.objects.filter(payment_date__year=year)
        if not request.user.is_superuser:
            qs = qs.filter(student_fee__student__user__school=school)

        month_rows = (
            qs.annotate(month=ExtractMonth('payment_date'))
            .values('month')
            .annotate(amount=Sum('amount'))
            .order_by('month')
        )
        month_to_amount = {int(r['month']): r['amount'] for r in month_rows if r.get('month')}

        month_labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        monthly = []
        total = Decimal('0.00')
        for idx, label in enumerate(month_labels, start=1):
            amount = month_to_amount.get(idx) or Decimal('0.00')
            total += amount
            monthly.append(
                {
                    'month': label,
                    'amount': float(amount),
                }
            )

        return Response(
            {
                'year': year,
                'total_collection': float(total),
                'monthly': monthly,
            }
        )


class AdminFeesExportCSVView(views.APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        school = request.user.school
        qs = StudentFee.objects.select_related(
            'student__user',
            'student__class_section__class_ref',
            'student__class_section__section_ref',
            'fee_structure',
        )
        if not request.user.is_superuser:
            qs = qs.filter(student__user__school=school)
            
        qs = qs.order_by('id')

        class_id = request.query_params.get('class_id')
        if class_id:
            qs = qs.filter(student__class_section__class_ref_id=class_id)

        buf = BytesIO()
        w = csv.writer(buf)
        w.writerow(
            [
                'ID',
                'Student',
                'Admission',
                'Class',
                'Total Fees',
                'Paid',
                'Due',
                'Status',
                'Due Date',
                'Overdue',
            ]
        )
        today = timezone.now().date()
        for r in qs:
            cs = r.student.class_section
            cls = f"{cs.class_ref.name}-{cs.section_ref.name}" if cs else ''
            overdue = r.status != 'paid' and r.due_date < today
            w.writerow(
                [
                    r.id,
                    r.student.user.name or r.student.user.username,
                    r.student.admission_number,
                    cls,
                    r.fee_structure.total_fees,
                    r.amount_paid,
                    r.due_amount,
                    r.status,
                    r.due_date,
                    overdue,
                ]
            )
        data = buf.getvalue()
        buf.close()
        resp = HttpResponse(data, content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename="student_fees.csv"'
        return resp


class AdminPaymentReminderView(views.APIView):
    """UI-only hook: no email integration yet."""

    permission_classes = [IsAdmin]

    def post(self, request):
        school = request.user.school
        student_fee_id = request.data.get('student_fee_id')
        if not student_fee_id:
            return Response({"error": "student_fee_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        qs = StudentFee.objects.select_related('student__user').filter(id=student_fee_id)
        if not request.user.is_superuser:
            qs = qs.filter(student__user__school=school)
            
        sf = qs.first()
        if not sf:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        # Placeholder for SMS/email
        return Response(
            {
                "message": "Reminder queued (demo — connect SMS/email in production)",
                "student": sf.student.user.name or sf.student.user.username,
                "due_amount": str(sf.due_amount),
            }
        )
