"""Service for bulk ID card generation on A4 pages in 2x5 grid."""
import os
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from django.conf import settings

# CR80 Standard Size
CARD_W = 85.60 * mm
CARD_H = 53.98 * mm

# A4 is 210 x 297 mm
PAGE_W, PAGE_H = A4

# Grid config
COLS = 2
ROWS = 5
CARDS_PER_PAGE = COLS * ROWS

# Gutters (spacing between cards)
GUTTER_X = 5 * mm
GUTTER_Y = 3 * mm

# Margins to center the grid
# Total Width = (COLS * CARD_W) + ((COLS-1) * GUTTER_X)
# Total Height = (ROWS * CARD_H) + ((ROWS-1) * GUTTER_Y)
TOTAL_W = (COLS * CARD_W) + ((COLS - 1) * GUTTER_X)
TOTAL_H = (ROWS * CARD_H) + ((ROWS - 1) * GUTTER_Y)

MARGIN_X = (PAGE_W - TOTAL_W) / 2
MARGIN_Y = (PAGE_H - TOTAL_H) / 2

def _draw_photo(canv, image_path, x, y, w, h):
    """Draws photo with object-fit: cover logic."""
    try:
        if not image_path or not os.path.exists(image_path):
            return
        ir = ImageReader(image_path)
        iw, ih = ir.getSize()
        scale = max(w / float(iw), h / float(ih))
        tw, th = iw * scale, ih * scale
        cx = x + (w - tw) / 2
        cy = y + (h - th) / 2
        
        canv.saveState()
        p = canv.beginPath()
        p.rect(x, y, w, h)
        canv.clipPath(p, stroke=0, fill=0)
        canv.drawImage(ir, cx, cy, width=tw, height=th, mask='auto')
        canv.restoreState()
    except Exception:
        pass

def draw_single_card(c, x, y, user_data, school_info):
    """Draws a single ID card at given (x, y) coordinates."""
    # Colors (UI Standard: Yellow header #ffcc00, Dark Blue accents #0f172a)
    yellow_header = (1.0, 0.8, 0.0) # #ffcc00
    dark_navy = (0.05, 0.09, 0.16)   # #0f172a
    white = (1.0, 1.0, 1.0)
    label_gray = (0.39, 0.45, 0.54) # #64748b
    text_slate = (0.12, 0.16, 0.23) # #1e293b
    
    # --- 1. Card Base & Background ---
    # Draw white background with subtle border
    c.setStrokeColorRGB(0.88, 0.91, 0.94)
    c.setLineWidth(0.4)
    c.setFillColorRGB(*white)
    c.roundRect(x, y, CARD_W, CARD_H, 3 * mm, stroke=1, fill=1)
    
    # --- 1.5 Background Hero Image (Subtle watermark) ---
    hero_path = school_info.get('hero_image_path')
    if hero_path and os.path.exists(hero_path):
        try:
            c.saveState()
            # Create clipping path for the card base (rounded corners)
            p = c.beginPath()
            p.roundRect(x, y, CARD_W, CARD_H, 3 * mm)
            c.clipPath(p, stroke=0, fill=0)
            
            # Set transparency (Alpha) for background
            c.setFillAlpha(0.08) # Very subtle
            
            # Draw hero image across the entire card
            _draw_photo(c, hero_path, x, y, CARD_W, CARD_H)
            
            c.restoreState()
        except Exception:
            pass
    
    # --- 2. Header (Yellow) ---
    header_h = 11.5 * mm
    c.saveState()
    # Create clipping path for rounded top corners
    p = c.beginPath()
    p.roundRect(x, y + CARD_H - header_h, CARD_W, header_h, 3 * mm)
    c.clipPath(p, stroke=0, fill=0)
    # Fill the clipped area with yellow
    c.setFillColorRGB(*yellow_header)
    c.rect(x, y + CARD_H - header_h, CARD_W, header_h, stroke=0, fill=1)
    c.restoreState()
    
    # Header Bottom Border (Thick Dark Navy as in UI)
    c.setStrokeColorRGB(*dark_navy)
    c.setLineWidth(1.0)
    c.line(x, y + CARD_H - header_h, x + CARD_W, y + CARD_H - header_h)
    
    # Logo (Top Left of Header)
    logo_path = school_info.get('logo_path')
    logo_w = 0
    if logo_path and os.path.exists(logo_path):
        try:
            logo_w = 8 * mm
            logo_h = 8 * mm
            lx_logo = x + 4 * mm
            ly_logo = y + CARD_H - (header_h + logo_h) / 2
            c.drawImage(ImageReader(logo_path), lx_logo, ly_logo, width=logo_w, height=logo_h, mask='auto')
            logo_w += 2 * mm # Padding for text
        except Exception:
            logo_w = 0

    # School Name (Centered in Yellow Header, accounting for logo)
    school_name = (school_info.get('name') or 'Standard Public School').upper()[:45]
    c.setFillColorRGB(*dark_navy)
    c.setFont('Helvetica-Bold', 8.5)
    tw = c.stringWidth(school_name, 'Helvetica-Bold', 8.5)
    
    # If logo exists, try to center name in the remaining space or just center globally
    # Centering globally is usually better for symmetry unless logo is huge
    c.drawString(x + (CARD_W - tw) / 2 + (logo_w/4 if logo_w else 0), y + CARD_H - 7 * mm, school_name)
    
    # --- 3. Body Content ---
    
    # Photo Frame (Right Side)
    photo_w = 18 * mm
    photo_h = 23 * mm
    rx = x + CARD_W - photo_w - 4 * mm
    ry = y + 4.5 * mm
    
    # Draw photo if available
    photo_path = user_data.get('photo_path')
    if photo_path:
        c.saveState()
        pp = c.beginPath()
        pp.roundRect(rx, ry, photo_w, photo_h, 2 * mm)
        c.clipPath(pp, stroke=0, fill=0)
        _draw_photo(c, photo_path, rx, ry, photo_w, photo_h)
        c.restoreState()
    
    # Photo Border (as seen in UI)
    c.setStrokeColorRGB(0.88, 0.91, 0.94)
    c.setLineWidth(0.6)
    c.roundRect(rx, ry, photo_w, photo_h, 2 * mm, stroke=1, fill=0)
    
    # Details (Left Side)
    dx = x + 4.5 * mm
    dy = y + CARD_H - header_h - 5 * mm
    line_h = 3.2 * mm
    
    # Name (Bold & Navy)
    c.setFillColorRGB(*dark_navy)
    c.setFont('Helvetica-Bold', 7.5)
    c.drawString(dx, dy, user_data.get('name', 'Name')[:30])
    dy -= 4.5 * mm
    
    # Detail Rows (Matching UI Labels)
    details = user_data.get('details', [])
    for label, value in details[:7]:
        c.setFillColorRGB(*label_gray)
        c.setFont('Helvetica-Bold', 5.5)
        c.drawString(dx, dy, f"{label}:")
        
        c.setFillColorRGB(*text_slate)
        c.setFont('Helvetica-Bold', 5.5)
        c.drawString(dx + 16 * mm, dy, str(value or '—')[:30])
        dy -= line_h

    # --- 4. Accent (Bottom Bar) ---
    c.setLineWidth(1.4)
    c.setStrokeColorRGB(0.14, 0.38, 0.92) # Blue part
    c.line(x + 4*mm, y + 1.2*mm, x + CARD_W/2, y + 1.2*mm)
    c.setStrokeColorRGB(1.0, 0.8, 0.0) # Yellow part
    c.line(x + CARD_W/2, y + 1.2*mm, x + CARD_W - 4*mm, y + 1.2*mm)

def generate_bulk_pdf(users_data, school_info):
    """Generates multi-page A4 PDF with 10 cards per page."""
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    
    total_users = len(users_data)
    for i, user in enumerate(users_data):
        # Calculate position on current page
        page_idx = i % CARDS_PER_PAGE
        col = page_idx % COLS
        row = page_idx // COLS # 0 to 4
        
        # In PDF coordinates, (0,0) is bottom-left
        # Grid layout: 
        # Row 0 is at top, Row 4 is at bottom
        # Y coordinate for row 'r' = PAGE_H - MARGIN_Y - ((r + 1) * CARD_H)
        x = MARGIN_X + (col * (CARD_W + GUTTER_X))
        y = PAGE_H - MARGIN_Y - (row * (CARD_H + GUTTER_Y)) - CARD_H
        
        draw_single_card(c, x, y, user, school_info)
        
        # If last card of the page and not the last card overall, showPage
        if (page_idx == CARDS_PER_PAGE - 1) and (i < total_users - 1):
            c.showPage()
            
    c.showPage()
    c.save()
    return buf.getvalue()
