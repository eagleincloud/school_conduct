# Migration 0008: Drop old parent columns (separate transaction from 0007).

from django.db import migrations


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
                migrations.RunSQL(
                    sql="""
                        DO $$
                        BEGIN
                            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students_studentprofile' AND column_name='parent_guardian_name') THEN
                                ALTER TABLE students_studentprofile DROP COLUMN parent_guardian_name;
                            END IF;
                            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students_studentprofile' AND column_name='parent_contact_number') THEN
                                ALTER TABLE students_studentprofile DROP COLUMN parent_contact_number;
                            END IF;
                        END $$;
                    """,
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
        ),
    ]
