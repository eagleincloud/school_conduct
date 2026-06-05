from .models import User

def get_unique_username(base_username):
    """
    Generates a unique username by appending a suffix if the base_username exists.
    Example: 'rahul' -> 'rahul_1', 'rahul_2', etc.
    """
    if not User.objects.filter(username=base_username).exists():
        return base_username
    
    counter = 1
    new_username = f"{base_username}_{counter}"
    while User.objects.filter(username=new_username).exists():
        counter += 1
        new_username = f"{base_username}_{counter}"
    
    return new_username
