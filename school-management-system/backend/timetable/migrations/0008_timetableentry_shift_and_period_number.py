from django.conf import settings
from django.db import migrations, models


def _has_column(schema_editor, table_name, column_name):
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            cursor.execute(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = %s AND column_name = %s
                LIMIT 1
                """,
                [table_name, column_name],
            )
            return cursor.fetchone() is not None
        if connection.vendor == 'sqlite':
            cursor.execute(f"PRAGMA table_info({table_name})")
            return any(row[1] == column_name for row in cursor.fetchall())
    return False


def ensure_timetable_columns(apps, schema_editor):
    connection = schema_editor.connection
    vendor = connection.vendor
    table_name = 'timetable_timetableentry'

    if not _has_column(schema_editor, table_name, 'period_number'):
        if vendor == 'postgresql':
            schema_editor.execute(
                "ALTER TABLE timetable_timetableentry ADD COLUMN period_number integer NOT NULL DEFAULT 1"
            )
        elif vendor == 'sqlite':
            schema_editor.execute(
                "ALTER TABLE timetable_timetableentry ADD COLUMN period_number integer DEFAULT 1"
            )

    if not _has_column(schema_editor, table_name, 'shift'):
        if vendor == 'postgresql':
            schema_editor.execute(
                "ALTER TABLE timetable_timetableentry ADD COLUMN shift varchar(20) NOT NULL DEFAULT 'morning'"
            )
        elif vendor == 'sqlite':
            schema_editor.execute(
                "ALTER TABLE timetable_timetableentry ADD COLUMN shift varchar(20) DEFAULT 'morning'"
            )

    if vendor == 'postgresql':
        schema_editor.execute(
            "ALTER TABLE timetable_timetableentry ALTER COLUMN period DROP NOT NULL"
        )


def forward_fill_shift_period(apps, schema_editor):
    vendor = schema_editor.connection.vendor
    if vendor == 'postgresql':
        schema_editor.execute(
            """
            UPDATE timetable_timetableentry
            SET shift = CASE
                WHEN start_time >= TIME '13:00:00' THEN 'afternoon'
                ELSE 'morning'
            END
            """
        )
        schema_editor.execute(
            """
            UPDATE timetable_timetableentry
            SET period_number = CASE
                WHEN shift = 'morning' THEN
                    CASE
                        WHEN start_time = TIME '08:00:00' THEN 1
                        WHEN start_time = TIME '08:30:00' THEN 2
                        WHEN start_time = TIME '09:00:00' THEN 3
                        WHEN start_time = TIME '09:30:00' THEN 4
                        WHEN start_time = TIME '10:00:00' THEN 5
                        WHEN start_time = TIME '11:00:00' THEN 6
                        WHEN start_time = TIME '11:30:00' THEN 7
                        WHEN start_time = TIME '12:00:00' THEN 8
                        WHEN COALESCE(period, 1) = 2 THEN 3
                        WHEN COALESCE(period, 1) = 3 THEN 5
                        WHEN COALESCE(period, 1) = 4 THEN 8
                        ELSE 1
                    END
                ELSE
                    CASE
                        WHEN start_time = TIME '13:00:00' THEN 1
                        WHEN start_time = TIME '13:30:00' THEN 2
                        WHEN start_time = TIME '14:00:00' THEN 3
                        WHEN start_time = TIME '14:30:00' THEN 4
                        WHEN start_time = TIME '15:30:00' THEN 5
                        WHEN start_time = TIME '16:00:00' THEN 6
                        WHEN start_time = TIME '16:30:00' THEN 7
                        WHEN COALESCE(period, 1) = 6 THEN 3
                        ELSE 1
                    END
            END
            """
        )
        schema_editor.execute("UPDATE timetable_timetableentry SET period = period_number")


class Migration(migrations.Migration):
    dependencies = [
        ('tenants', '0001_initial'),
        ('timetable', '0007_alter_timetableentry_unique_together'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='timetableentry',
                    name='period_number',
                    field=models.IntegerField(default=1),
                ),
                migrations.AddField(
                    model_name='timetableentry',
                    name='shift',
                    field=models.CharField(
                        choices=[('morning', 'Morning Shift'), ('afternoon', 'Afternoon Shift')],
                        default='morning',
                        max_length=20,
                    ),
                ),
                migrations.AlterField(
                    model_name='timetableentry',
                    name='period',
                    field=models.IntegerField(blank=True, default=1, null=True),
                ),
                migrations.AlterUniqueTogether(
                    name='timetableentry',
                    unique_together={
                        ('school', 'class_name', 'section', 'shift', 'day', 'period_number'),
                        ('school', 'teacher', 'shift', 'day', 'period_number'),
                    },
                ),
            ],
            database_operations=[
                migrations.RunPython(ensure_timetable_columns, migrations.RunPython.noop),
                migrations.RunPython(forward_fill_shift_period, migrations.RunPython.noop),
            ],
        ),
    ]
