# Migration 0008: Drop old parent columns (separate transaction from 0007).

from django.db import migrations


def _drop_parent_columns(apps, schema_editor):
    # Only execute raw SQL on PostgreSQL to avoid SQLite syntax errors
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("ALTER TABLE students_studentprofile DROP COLUMN IF EXISTS parent_guardian_name;")
        cursor.execute("ALTER TABLE students_studentprofile DROP COLUMN IF EXISTS parent_contact_number;")


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
                migrations.RunPython(_drop_parent_columns, reverse_code=migrations.RunPython.noop),
            ],
        ),
    ]
