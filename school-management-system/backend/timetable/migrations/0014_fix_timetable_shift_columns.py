# Generated manually on 2026-06-16

from django.db import migrations

def make_columns_nullable(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            # Drop NOT NULL constraints if columns exist
            cursor.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_name='timetable_shift' AND column_name='applies_to'
                    ) THEN
                        ALTER TABLE timetable_shift ALTER COLUMN applies_to DROP NOT NULL;
                    END IF;
                    
                    IF EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_name='timetable_shift' AND column_name='is_flexible'
                    ) THEN
                        ALTER TABLE timetable_shift ALTER COLUMN is_flexible DROP NOT NULL;
                    END IF;
                END $$;
            """)
    elif connection.vendor == 'sqlite':
        pass

class Migration(migrations.Migration):

    dependencies = [
        ('timetable', '0013_drop_stale_teacher_constraint'),
    ]

    operations = [
        migrations.RunPython(
            make_columns_nullable,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
