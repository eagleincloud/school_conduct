from django.db import migrations


def fix_constraints(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            # Drop the old constraint that only included (teacher, class, subject)
            cursor.execute("""
                ALTER TABLE subjects_teacherassignment 
                DROP CONSTRAINT IF EXISTS subjects_teacherassignme_teacher_id_class_ref_id__c45d60ae_uniq;
            """)
            # Add the new exhaustive constraint
            # Note: We use a new name to avoid collisions
            cursor.execute("""
                ALTER TABLE subjects_teacherassignment 
                ADD CONSTRAINT subjects_teacherassignment_full_unique 
                UNIQUE (teacher_id, class_ref_id, section_id, subject_id, role);
            """)


class Migration(migrations.Migration):

    dependencies = [
        ('subjects', '0004_alter_teacherassignment_unique_together_and_more'),
    ]

    operations = [
        migrations.RunPython(fix_constraints, migrations.RunPython.noop),
    ]
