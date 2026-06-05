"""Teacher ID card PDF — same shell as student: gold header, details left, ID + photo right."""
from __future__ import annotations

import os
from io import BytesIO

from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from .models import TeacherProfile


def _header_title(school_name: str) -> str:
    s = (school_name or '').strip()
    if not s or s == 'School Management System':
        return 'School Name'
    return s[:64]


def _clip(s: str, n: int) -> str:
    if not s:
        return '—'
    s = str(s).strip()
    return s if len(s) <= n else s[: n - 1] + '…'


def _draw_photo_cover_box(canv, image_path: str, x: float, y: float, box_w: float, box_h: float) -> None:
    ir = ImageReader(image_path)
    iw, ih = ir.getSize()
    if iw <= 0 or ih <= 0:
        return
    scale = max(box_w / float(iw), box_h / float(ih))
    tw, th = iw * scale, ih * scale
    cx = x + (box_w - tw) / 2
    cy = y + (box_h - th) / 2
    canv.saveState()
    p = canv.beginPath()
    p.rect(x, y, box_w, box_h)
    canv.clipPath(p, stroke=0, fill=0)
    canv.drawImage(ir, cx, cy, width=tw, height=th, mask='auto')
    canv.restoreState()


def build_teacher_id_card_pdf(
    teacher: TeacherProfile,
    *,
    school_name: str,
    role_label: str,
    school_address: str = '',
    school_phone: str = '',
    school_email: str = '',
    school_website: str = '',
    logo_path: str = None,
    hero_image_path: str = None,
) -> bytes:
    W, H = 128 * mm, 74 * mm
    m = 3.0 * mm
    header_h = 14 * mm
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=(W, H))

    navy = (0.10, 0.24, 0.48)
    gold = (0.99, 0.84, 0.28)
    body_bg = (0.98, 0.98, 0.97)

    c.setStrokeColorRGB(*navy)
    c.setLineWidth(1.3)
    c.roundRect(m, m, W - 2 * m, H - 2 * m, 3.5, stroke=1, fill=0)

    # background hero watermark
    if hero_image_path and os.path.exists(hero_image_path):
        try:
            c.saveState()
            p = c.beginPath()
            p.roundRect(m, m, W - 2 * m, H - 2 * m, 3.5)
            c.clipPath(p, stroke=0, fill=0)
            c.setFillAlpha(0.08)
            _draw_photo_cover_box(c, hero_image_path, m, m, W - 2 * m, H - 2 * m)
            c.restoreState()
        except: pass

    c.setFillColorRGB(*gold)
    c.rect(m, H - m - header_h, W - 2 * m, header_h, stroke=0, fill=1)

    body_top_y = H - m - header_h
    c.setFillColorRGB(*body_bg)
    c.rect(m, m, W - 2 * m, body_top_y - m, stroke=0, fill=1)

    # Logo (Header Left)
    logo_w = 0
    if logo_path and os.path.exists(logo_path):
        try:
            lw, lh = 9 * mm, 9 * mm
            lx = m + 4 * mm
            ly = H - m - (header_h + lh)/2
            c.drawImage(ImageReader(logo_path), lx, ly, width=lw, height=lh, mask='auto')
            logo_w = lw + 2 * mm
        except: pass

    title = _header_title(school_name)
    c.setFillColorRGB(0, 0, 0)
    c.setFont('Helvetica-Bold', 14)
    tw = c.stringWidth(title, 'Helvetica-Bold', 14)
    c.drawString((W - tw) / 2 + (logo_w/4 if logo_w else 0), H - m - header_h + 4.2 * mm, title)

    contact_bits = []
    if school_phone:
        contact_bits.append(f'Tel: {_clip(school_phone, 22)}')
    if school_email:
        contact_bits.append(_clip(school_email, 28))
    if school_website:
        contact_bits.append(_clip(school_website, 28))
    if contact_bits:
        c.setFont('Helvetica', 6.5)
        wy = H - m - header_h + 8 * mm
        for line in contact_bits[:3]:
            lw = c.stringWidth(line, 'Helvetica', 6.5)
            c.drawString(W - m - lw - 1 * mm, wy, line)
            wy -= 2.6 * mm

    lx = m + 3.5 * mm
    y = body_top_y - 4 * mm
    line = 4.2 * mm
    label_x = lx + 28 * mm

    name = _clip(teacher.user.name or teacher.user.username, 40)
    prefix = teacher.school.school_id if teacher.school else 'NS'
    eid = _clip(f"{prefix}-{teacher.employee_id}", 20)
    role = _clip(role_label or 'Teacher', 42)
    spec = _clip(teacher.subject_specialization, 40)
    phone = _clip(teacher.phone_number or teacher.user.phone or '', 20)

    c.setFillColorRGB(0.05, 0.05, 0.08)

    def row(lbl, val, lw=28 * mm):
        nonlocal y
        c.setFont('Helvetica-Bold', 8.5)
        c.drawString(lx, y, lbl)
        c.setFont('Helvetica', 8.5)
        c.drawString(lx + lw, y, val)
        y -= line

    row('Name:', name)
    row('Employee ID:', eid)
    row('Role:', role)
    row('Phone:', phone)
    row('Specialization:', spec)

    photo_w = 31 * mm
    rx = W - m - photo_w - 4 * mm
    photo_top_y = body_top_y - 4 * mm
    py = m + 5 * mm
    photo_h = max(30 * mm, photo_top_y - py)

    if teacher.photo and teacher.photo.name:
        try:
            _draw_photo_cover_box(c, teacher.photo.path, rx, py, photo_w, photo_h)
        except Exception:
            pass

    c.setStrokeColorRGB(0.75, 0.75, 0.78)
    c.setLineWidth(0.8)
    c.rect(rx, py, photo_w, photo_h, stroke=1, fill=0)

    if school_address:
        c.setFillColorRGB(0.45, 0.45, 0.5)
        c.setFont('Helvetica', 6.5)
        fa = _clip(school_address, 72)
        fw = c.stringWidth(fa, 'Helvetica', 6.5)
        c.drawString((W - fw) / 2, m + 1.2 * mm, fa)

    c.showPage()
    c.save()
    return buf.getvalue()
