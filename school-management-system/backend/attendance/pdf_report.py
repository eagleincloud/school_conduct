from __future__ import annotations

from collections import defaultdict
from datetime import date as date_type
from io import BytesIO
from typing import Iterable

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']


def _format_status(status_value: str) -> str:
    return (status_value or '').strip().capitalize()


def build_student_attendance_report_pdf(
    *,
    student_name: str,
    class_label: str,
    period_label: str,
    attendance_records: Iterable,
    summary: dict,
    subject_rows: list[dict],
    daily_rows: list[dict],
) -> bytes:
    """
    Build a simple A4 PDF for student attendance.

    Note: The project uses `reportlab` elsewhere (fees receipts), so we keep it consistent.
    """
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)

    width, height = A4
    x_margin = 50
    y = height - 60

    c.setFont('Helvetica-Bold', 16)
    c.drawString(x_margin, y, 'Student Attendance Report')

    y -= 22
    c.setFont('Helvetica', 11)
    c.drawString(x_margin, y, f'Student: {student_name}')
    y -= 16
    c.drawString(x_margin, y, f'Class: {class_label}')
    y -= 16
    c.drawString(x_margin, y, f'Period: {period_label}')

    y -= 20
    c.setFont('Helvetica-Bold', 12)
    c.drawString(x_margin, y, 'Summary')
    y -= 16

    c.setFont('Helvetica', 11)
    c.drawString(x_margin, y, f"Total Attendance Percentage: {summary.get('attendance_percentage', 0):.1f}%")
    y -= 14
    c.drawString(x_margin, y, f"Present Days (includes Late): {summary.get('present_days', 0)}")
    y -= 14
    c.drawString(x_margin, y, f"Absent Days: {summary.get('absent_days', 0)}")

    y -= 18
    c.setFont('Helvetica-Bold', 12)
    c.drawString(x_margin, y, 'Subject-wise Attendance')
    y -= 16

    c.setFont('Helvetica', 10)
    header = ['Subject', 'Present', 'Total', 'Percent']
    c.drawString(x_margin, y, ' | '.join(header))
    y -= 12

    def safe_next_line():
        nonlocal y
        y -= 12
        if y < 60:
            c.showPage()
            y = height - 60
            c.setFont('Helvetica', 10)

    # subject_rows expected sorted list
    for row in subject_rows:
        safe_next_line()
        percent = row.get('percentage', 0.0)
        line = [
            row.get('subject_name', ''),
            str(row.get('present_classes', 0)),
            str(row.get('total_classes', 0)),
            f"{percent:.1f}%",
        ]
        c.drawString(x_margin, y, ' | '.join(line))

    # For readability, include daily rows only for monthly reports (passed from view).
    if daily_rows:
        y -= 12
        c.setFont('Helvetica-Bold', 12)
        c.drawString(x_margin, y, 'Daily Attendance')
        y -= 16
        c.setFont('Helvetica', 10)
        for dr in daily_rows:
            safe_next_line()
            line = f"{dr.get('date')} - {_format_status(dr.get('status'))} - {dr.get('marked_via') or ''}"
            c.drawString(x_margin, y, line)

    c.save()
    return buf.getvalue()

