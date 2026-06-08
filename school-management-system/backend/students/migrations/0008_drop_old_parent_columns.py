# Migration 0008: Drop old parent columns (separate transaction from 0007).

from django.db import migrations

def drop_columns_safe(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students_studentprofile' AND column_name='parent_guardian_name') THEN
                        ALTER TABLE students_studentprofile DROP COLUMN parent_guardian_name;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students_studentprofile' AND column_name='parent_contact_number') THEN
                        ALTER TABLE students_studentprofile DROP COLUMN parent_contact_number;
                    END IF;
                END $$;
            """)
    elif connection.vendor == 'sqlite':
        try:
            with connection.cursor() as cursor:
                columns = [col[0] for col in connection.introspection.get_table_description(cursor, 'students_studentprofile')]
            for col_name in ['parent_guardian_name', 'parent_contact_number']:
                if col_name in columns:
                    with connection.cursor() as cursor:
                        cursor.execute(f"ALTER TABLE students_studentprofile DROP COLUMN {col_name}")
        except Exception:
            pass


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0007_remove_studentprofile_parent_contact_number_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(
                    model_name='studentprofile',
                    name='parent_guardian_name',
                ),
                migrations.RemoveField(
                    model_name='studentprofile',
                    name='parent_contact_number',
                ),
            ],
            database_operations=[
                migrations.RunPython(
                    drop_columns_safe,
                    reverse_code=migrations.RunPython.noop,
                ),
            ],
        ),
    ]

