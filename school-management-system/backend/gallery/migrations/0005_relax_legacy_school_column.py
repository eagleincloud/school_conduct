# Legacy compatibility: old schemas may contain required `school_id`.

from django.db import migrations


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
        migrations.RunPython(_relax_school_id, reverse_code=migrations.RunPython.noop),
    ]

