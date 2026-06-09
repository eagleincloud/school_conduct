# Legacy compatibility: old schemas may still have a required `caption` column.

from django.db import migrations

def relax_caption_column(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute("""
                DO $$ BEGIN 
                IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema='public' AND table_name='gallery_galleryimage' AND column_name='caption'
                ) THEN 
                ALTER TABLE gallery_galleryimage 
                ALTER COLUMN caption DROP NOT NULL; 
                ALTER TABLE gallery_galleryimage 
                ALTER COLUMN caption SET DEFAULT ''; 
                END IF; 
                END $$;
            """)
    elif connection.vendor == 'sqlite':
        pass


def _relax_caption(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    conn = schema_editor.connection
    with conn.cursor() as cursor:
        cursor.execute("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='gallery_galleryimage' AND column_name='caption';")
        if cursor.fetchone():
            cursor.execute("ALTER TABLE gallery_galleryimage ALTER COLUMN caption DROP NOT NULL;")
            cursor.execute("ALTER TABLE gallery_galleryimage ALTER COLUMN caption SET DEFAULT '';")


class Migration(migrations.Migration):
    dependencies = [
        ('gallery', '0003_repair_title_column'),
    ]

    operations = [
        migrations.RunPython(
            relax_caption_column,
            reverse_code=migrations.RunPython.noop,
        ),
    ]


