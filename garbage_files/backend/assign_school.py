import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from accounts.models import User
from tenants.models import School

username = "shiv"
school_id = "DEFAULT"

user = User.objects.filter(username=username).first()
school = School.objects.filter(school_id=school_id).first()

if user and school:
    user.school = school
    user.save()
    print(f"Successfully assigned user '{username}' to school '{school.name}' ({school.school_id}).")
else:
    if not user:
        print(f"User '{username}' NOT found.")
    if not school:
        print(f"School with school_id '{school_id}' NOT found.")
