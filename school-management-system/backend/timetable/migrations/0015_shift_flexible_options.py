from django.db import migrations, models


def add_shift_flexible_columns(apps, schema_editor):
    table_name = 'timetable_shift'
    existing_columns = {
        column.name for column in schema_editor.connection.introspection.get_table_description(
            schema_editor.connection.cursor(),
            table_name,
        )
    }

    with schema_editor.connection.cursor() as cursor:
        if 'is_flexible' not in existing_columns:
            cursor.execute(
                f"ALTER TABLE {table_name} ADD COLUMN is_flexible boolean NOT NULL DEFAULT false"
            )
        if 'applies_to' not in existing_columns:
            cursor.execute(
                f"ALTER TABLE {table_name} ADD COLUMN applies_to varchar(20) NOT NULL DEFAULT 'both'"
            )


def remove_shift_flexible_columns(apps, schema_editor):
    table_name = 'timetable_shift'
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(f"ALTER TABLE {table_name} DROP COLUMN IF EXISTS is_flexible")
        cursor.execute(f"ALTER TABLE {table_name} DROP COLUMN IF EXISTS applies_to")


class Migration(migrations.Migration):

    dependencies = [
        ('timetable', '0014_fix_timetable_shift_columns'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    add_shift_flexible_columns,
                    reverse_code=remove_shift_flexible_columns,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='shift',
                    name='is_flexible',
                    field=models.BooleanField(default=False),
                ),
                migrations.AddField(
                    model_name='shift',
                    name='applies_to',
                    field=models.CharField(
                        choices=[
                            ('students', 'Students'),
                            ('teachers', 'Teachers'),
                            ('both', 'Students & Teachers'),
                            ('academic', 'Academic'),
                        ],
                        default='both',
                        max_length=20,
                    ),
                ),
            ],
        ),
    ]
