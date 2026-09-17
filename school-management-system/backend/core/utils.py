import secrets
import string
import os
from io import BytesIO

def generate_random_password(length=12):
    """
    Generates a secure random password.
    """
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(characters) for _ in range(length))

def format_phone_number(phone):
    """
    Basic phone number formatting.
    """
    return phone.replace(" ", "").replace("-", "") if phone else None

def get_safe_image_source(file_field):
    """
    Safely gets an image source that ReportLab's ImageReader can use.
    Works for both local FileSystemStorage and remote backends (like Cloudinary).
    """
    if not file_field or not file_field.name:
        return None
        
    # 1. Try local storage path
    try:
        path = file_field.path
        if os.path.exists(path):
            return path
    except (NotImplementedError, ValueError):
        pass
        
    # 2. Fallback: Read file bytes into BytesIO for remote storages (e.g. Cloudinary)
    try:
        file_field.open('rb')
        data = BytesIO(file_field.read())
        file_field.close()
        return data
    except Exception:
        pass

    # 3. Last fallback: Try URL if available
    try:
        if file_field.url:
            return file_field.url
    except Exception:
        pass
        
    return None
