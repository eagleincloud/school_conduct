# Syncs Django model with PostgreSQL (and other DBs) where `target_role` may already exist.

from django.db import migrations, models


def add_target_role_if_missing(apps, schema_editor):
    conn = schema_editor.connection
    with conn.cursor() as cursor:
        if conn.vendor == 'postgresql':
            cursor.execute(
                """
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'communication_notification'
                  AND column_name = 'target_role'
                """
            )
            if cursor.fetchone():
                return
            cursor.execute(
                """
                ALTER TABLE communication_notification
                ADD COLUMN target_role varchar(10) NOT NULL DEFAULT 'student';
                """
            )
        elif conn.vendor == 'sqlite':
            cursor.execute('PRAGMA table_info(communication_notification)')
            cols = [row[1] for row in cursor.fetchall()]
            if 'target_role' in cols:
                return
            cursor.execute(
                'ALTER TABLE communication_notification ADD COLUMN target_role varchar(10) NOT NULL DEFAULT '
                "'student'"
            )
        else:
            raise NotImplementedError(
                f'Add target_role manually or extend this migration for DB vendor {conn.vendor!r}.'
            )


class Migration(migrations.Migration):

    dependencies = [
        ('communication', '0004_notification_related_announcement'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='notification',
                    name='target_role',
                    field=models.CharField(default='student', max_length=10),
                ),
            ],
            database_operations=[
                migrations.RunPython(add_target_role_if_missing, migrations.RunPython.noop),
            ],
        ),
    ]
