# Sync academics models with DB safely (school FK may already be absent).

from django.db import migrations


def _drop_school_column(apps, schema_editor, table: str):
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            cursor.execute(f'ALTER TABLE {table} DROP COLUMN IF EXISTS school_id')
        elif connection.vendor == 'sqlite':
            try:
                cursor.execute(f'ALTER TABLE {table} DROP COLUMN school_id')
            except Exception:
                pass


def sync_academics_db(apps, schema_editor):
    for table in (
        'academics_result',
        'academics_exam',
        'academics_subject',
        'academics_subjectteachermapping',
    ):
        _drop_school_column(apps, schema_editor, table)


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0001_initial'),
        ('classes', '0003_classsection_school_mainclass_school_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
            ],
            database_operations=[
                migrations.RunPython(sync_academics_db, migrations.RunPython.noop),
            ],
        ),
    ]
