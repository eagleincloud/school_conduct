# Manual repair migration for environments where an older gallery schema used `caption`.

from django.db import migrations


def _repair_title(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    conn = schema_editor.connection
    with conn.cursor() as cursor:
        cursor.execute("ALTER TABLE gallery_galleryimage ADD COLUMN IF NOT EXISTS title varchar(255) NULL;")
        # If caption column exists, copy non-empty caption into title, else set default
        cursor.execute("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='gallery_galleryimage' AND column_name='caption';")
        if cursor.fetchone():
            cursor.execute("UPDATE gallery_galleryimage SET title=COALESCE(NULLIF(caption, ''), 'Untitled') WHERE title IS NULL;")
        else:
            cursor.execute("UPDATE gallery_galleryimage SET title='Untitled' WHERE title IS NULL;")
        cursor.execute("ALTER TABLE gallery_galleryimage ALTER COLUMN title SET NOT NULL;")


class Migration(migrations.Migration):
    dependencies = [
        ('gallery', '0002_repair_uploaded_by_column'),
    ]

    operations = [
        migrations.RunPython(_repair_title, reverse_code=migrations.RunPython.noop),
    ]

