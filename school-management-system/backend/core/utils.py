import random
import string

def generate_random_password(length=12):
    """
    Generates a secure random password.
    """
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(random.choice(characters) for i in range(length))

def format_phone_number(phone):
    """
    Basic phone number formatting.
    """
    return phone.replace(" ", "").replace("-", "") if phone else None
