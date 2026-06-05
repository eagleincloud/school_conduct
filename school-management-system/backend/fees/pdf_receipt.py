from io import BytesIO

from django.conf import settings
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def build_payment_receipt_pdf(payment) -> bytes:
    """Generate a simple A4 fee receipt PDF for a Payment instance."""
    buf = BytesIO()
    p = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    school = getattr(settings, 'SCHOOL_NAME', 'School')

    sf = payment.student_fee
    student = sf.student
    name = student.user.name or student.user.username
    cs = student.class_section
    class_str = f"{cs.class_ref.name} - {cs.section_ref.name}" if cs else 'N/A'

    y = height - 50
    p.setFont('Helvetica-Bold', 18)
    p.drawString(50, y, school)
    y -= 30
    p.setFont('Helvetica-Bold', 12)
    p.drawString(50, y, 'Fee Payment Receipt')
    y -= 28
    p.setFont('Helvetica', 10)

    lines = [
        f"Receipt # Payment ID: {payment.id}",
        f"Date: {payment.payment_date}",
        '',
        f"Student: {name}",
        f"Admission No: {student.admission_number}",
        f"Class: {class_str}",
        '',
        f"Amount Paid: ₹{payment.amount}",
        f"Payment Mode: {payment.payment_mode}",
        f"Transaction ID: {payment.transaction_id or '—'}",
        '',
        f"Student Fee Record ID: {sf.id}",
        f"Fee period due date: {sf.due_date}",
    ]
    for line in lines:
        p.drawString(50, y, line)
        y -= 16

    y -= 10
    p.setFont('Helvetica-Oblique', 9)
    p.drawString(50, y, 'This is a computer-generated receipt.')

    p.showPage()
    p.save()
    pdf_data = buf.getvalue()
    buf.close()
    return pdf_data
