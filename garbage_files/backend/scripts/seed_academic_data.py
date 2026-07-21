import os
import django
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from classes.models import MainClass, MainSection

def seed():
    print("Starting academic data seeding...")
    
    # Common School Classes (1 to 12)
    classes = [str(i) for i in range(1, 13)]
    # Common Sections
    sections = ['A', 'B', 'C', 'D']

    for name in classes:
        obj, created = MainClass.objects.get_or_create(name=name)
        if created:
            print(f"Created Class: {name}")
        else:
            print(f"Class already exists: {name}")

    for name in sections:
        obj, created = MainSection.objects.get_or_create(name=name)
        if created:
            print(f"Created Section: {name}")
        else:
            print(f"Section already exists: {name}")

    print("Seeding completed successfully!")

if __name__ == '__main__':
    seed()
