import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Drop the old table if it exists
    cursor.execute("DROP TABLE IF EXISTS attendance_teacherattendance CASCADE;")
    print("Dropped table attendance_teacherattendance")

    # Delete the migration record from django_migrations
    cursor.execute("DELETE FROM django_migrations WHERE app='attendance' AND name='0006_teacherattendance';")
    print("Deleted migration record for 0006_teacherattendance")
