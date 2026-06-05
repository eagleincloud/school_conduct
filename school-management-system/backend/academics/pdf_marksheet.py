from __future__ import annotations

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Frame, PageTemplate


def _safe_float(v) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def _pct_to_grade(pct: float) -> str:
    if pct >= 90: return 'A+'
    if pct >= 80: return 'A'
    if pct >= 70: return 'B'
    if pct >= 60: return 'C'
    if pct >= 50: return 'D'
    return 'F'


def build_student_marksheet_pdf(
    *,
    school_name: str,
    student_name: str,
    roll_number: str,
    class_label: str,
    academic_year: str,
    exam_type: str,
    declaration_date: str,
    total_obtained: float,
    total_max: float,
    percentage: float,
    overall_grade: str,
    final_result: str,
    subject_rows: list[dict],
    class_teacher_name: str,
    remarks: str,
) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=26,
        textColor=colors.hexColor('#1e293b'),
        alignment=1, # Center
        spaceAfter=10,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'SubtitleStyle',
        fontSize=16,
        textColor=colors.hexColor('#64748b'),
        alignment=1,
        spaceAfter=30,
        fontName='Helvetica-Bold'
    )

    label_style = ParagraphStyle(
        'LabelStyle',
        fontSize=10,
        textColor=colors.hexColor('#475569'),
        fontName='Helvetica-Bold'
    )

    value_style = ParagraphStyle(
        'ValueStyle',
        fontSize=11,
        textColor=colors.hexColor('#1e293b'),
        fontName='Helvetica'
    )

    elements = []

    # 1. School Header
    elements.append(Paragraph(school_name.upper(), title_style))
    elements.append(Paragraph(f"ACADEMIC PERFORMANCE REPORT - {academic_year}", subtitle_style))
    elements.append(Spacer(1, 0.2 * inch))

    # 2. Student Info Table
    info_data = [
        [Paragraph("STUDENT NAME", label_style), Paragraph(student_name.upper(), value_style), 
         Paragraph("ROLL NUMBER", label_style), Paragraph(roll_number, value_style)],
        [Paragraph("CLASS / SECTION", label_style), Paragraph(class_label, value_style), 
         Paragraph("EXAM TYPE", label_style), Paragraph(exam_type.upper(), value_style)],
        [Paragraph("DECLARATION DATE", label_style), Paragraph(declaration_date, value_style), 
         Paragraph("ACADEMIC YEAR", label_style), Paragraph(academic_year, value_style)],
    ]
    
    info_table = Table(info_data, colWidths=[1.4*inch, 2.2*inch, 1.4*inch, 2.2*inch])
    info_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.hexColor('#e2e8f0')),
        ('PADDING', (0,0), (-1,-1), 8),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,0), (0,-1), colors.hexColor('#f8fafc')),
        ('BACKGROUND', (2,0), (2,-1), colors.hexColor('#f8fafc')),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.4 * inch))

    # 3. Subject Marks Table
    subject_header = [
        Paragraph("SUBJECT", label_style), 
        Paragraph("MAX MARKS", label_style), 
        Paragraph("OBTAINED", label_style), 
        Paragraph("GRADE", label_style), 
        Paragraph("STATUS", label_style)
    ]
    
    table_data = [subject_header]
    for row in subject_rows:
        status_color = colors.hexColor('#16a34a') if row.get('result') == 'Pass' else colors.hexColor('#dc2626')
        table_data.append([
            row.get('subject', ''),
            row.get('max_marks', 0),
            row.get('marks', 0),
            row.get('grade', '—'),
            Paragraph(str(row.get('result', '—')).upper(), ParagraphStyle('Status', fontSize=9, textColor=status_color, fontName='Helvetica-Bold'))
        ])

    # Add Summary Row
    summary_label_style = ParagraphStyle('Sum', fontSize=10, textColor=colors.hexColor('#1e293b'), fontName='Helvetica-Bold')
    table_data.append([
        Paragraph("TOTAL AGGREGATE", summary_label_style),
        total_max,
        total_obtained,
        overall_grade,
        Paragraph(final_result.upper(), ParagraphStyle('FinalStat', fontSize=10, textColor=colors.white, alignment=1, fontName='Helvetica-Bold'))
    ])

    marks_table = Table(table_data, colWidths=[2.8*inch, 1.2*inch, 1.2*inch, 0.8*inch, 1.2*inch])
    
    result_bg = colors.hexColor('#16a34a') if final_result.lower() == 'pass' else colors.hexColor('#dc2626')

    marks_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.hexColor('#1e293b')), # Header
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('ALIGN', (0,0), (0,-1), 'LEFT'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('GRID', (0,0), (-1,-2), 0.5, colors.hexColor('#cbd5e1')),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        # Summary Row styling
        ('BACKGROUND', (0,-1), (-1,-1), colors.hexColor('#f1f5f9')),
        ('BACKGROUND', (-1,-1), (-1,-1), result_bg),
        ('LINEBELOW', (0,-1), (-1,-1), 2, colors.hexColor('#1e293b')),
    ]))
    elements.append(marks_table)
    elements.append(Spacer(1, 0.4 * inch))

    # 4. Remarks Section
    elements.append(Paragraph("TEACHER REMARKS", label_style))
    elements.append(Spacer(1, 0.1 * inch))
    remark_text = f"Class Teacher: {class_teacher_name} | Remarks: {remarks or 'Consistent performance.'}"
    elements.append(Paragraph(remark_text, value_style))
    elements.append(Spacer(1, 0.8 * inch))

    # 5. Signatures
    sig_data = [
        [Paragraph("__________________________", value_style), "", Paragraph("__________________________", value_style)],
        [Paragraph("CLASS TEACHER", label_style), "", Paragraph("PRINCIPAL / AUTHORIZED", label_style)]
    ]
    sig_table = Table(sig_data, colWidths=[2.5*inch, 2.2*inch, 2.5*inch])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    elements.append(sig_table)

    # PAGE BORDER FUNCTION
    def draw_border(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.hexColor('#1e293b'))
        canvas.setLineWidth(2)
        canvas.rect(20, 20, A4[0]-40, A4[1]-40)
        # Subtle school name watermark
        canvas.setFont('Helvetica-Bold', 60)
        canvas.setStrokeColor(colors.hexColor('#f1f5f9'))
        canvas.setFillOpacity(0.05)
        # Note: we can't easily rotate and center perfectly here without more code, 
        # but a simple footer is better for "Standard Public School"
        canvas.setFont('Helvetica', 8)
        canvas.setFillOpacity(1)
        canvas.setFillColor(colors.hexColor('#94a3b8'))
        canvas.drawCentredString(A4[0]/2, 30, f"This is an official document of {school_name}. Generated on {declaration_date}.")
        canvas.restoreState()

    doc.build(elements, onFirstPage=draw_border, onLaterPages=draw_border)
    
    data = buf.getvalue()
    buf.close()
    return data

