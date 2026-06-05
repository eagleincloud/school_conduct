from .models import FeeStructure, StudentFee

class FeeService:
    @staticmethod
    def get_student_fees(student_id):
        return StudentFee.objects.filter(student_id=student_id)

    @staticmethod
    def mark_as_paid(fee_id):
        fee = StudentFee.objects.get(id=fee_id)
        fee.status = 'paid'
        fee.save()
        return fee
