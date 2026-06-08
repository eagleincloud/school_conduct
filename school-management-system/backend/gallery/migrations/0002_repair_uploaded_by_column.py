# Manual repair migration for environments with drifted gallery schema.

from django.db import migrations


def _repair_uploaded_by(apps, schema_editor):
    # Only run raw SQL on PostgreSQL
    if schema_editor.connection.vendor != 'postgresql':
        return
    conn = schema_editor.connection
    with conn.cursor() as cursor:
        # Add column if missing
        cursor.execute("ALTER TABLE gallery_galleryimage ADD COLUMN IF NOT EXISTS uploaded_by_id bigint NULL;")
        # Create index if missing
        cursor.execute("CREATE INDEX IF NOT EXISTS gallery_galleryimage_uploaded_by_id_idx ON gallery_galleryimage (uploaded_by_id);")
        # Add FK constraint if accounts_user exists and constraint is missing
        cursor.execute("SELECT 1 FROM information_schema.tables WHERE table_name='accounts_user';")
        if cursor.fetchone():
            cursor.execute("SELECT 1 FROM pg_constraint WHERE conname='gallery_galleryimage_uploaded_by_id_9e3655b8_fk_accounts_user_id';")
            if not cursor.fetchone():
                cursor.execute(
                    "ALTER TABLE gallery_galleryimage ADD CONSTRAINT gallery_galleryimage_uploaded_by_id_9e3655b8_fk_accounts_user_id FOREIGN KEY (uploaded_by_id) REFERENCES accounts_user(id) DEFERRABLE INITIALLY DEFERRED;"
                )


class Migration(migrations.Migration):
    dependencies = [
        ('gallery', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(_repair_uploaded_by, reverse_code=migrations.RunPython.noop),
    ]

