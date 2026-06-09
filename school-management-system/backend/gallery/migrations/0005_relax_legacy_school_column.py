# Legacy compatibility: old schemas may contain required `school_id`.

from django.db import migrations

def relax_school_column(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute("""
                DO $$ BEGIN 
                IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema='public' AND table_name='gallery_galleryimage' AND column_name='school_id'
                ) THEN 
                ALTER TABLE gallery_galleryimage 
                ALTER COLUMN school_id DROP NOT NULL; 
                END IF; 
                END $$;
            """)
    elif connection.vendor == 'sqlite':
        pass


def _relax_school_id(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    conn = schema_editor.connection
    with conn.cursor() as cursor:
        cursor.execute("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='gallery_galleryimage' AND column_name='school_id';")
        if cursor.fetchone():
            cursor.execute("ALTER TABLE gallery_galleryimage ALTER COLUMN school_id DROP NOT NULL;")


class Migration(migrations.Migration):
    dependencies = [
        ('gallery', '0004_relax_legacy_caption_column'),
    ]

    operations = [
        migrations.RunPython(
            relax_school_column,
            reverse_code=migrations.RunPython.noop,
        ),
    ]


