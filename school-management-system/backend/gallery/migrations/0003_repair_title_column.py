# Manual repair migration for environments where an older gallery schema used `caption`.

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('gallery', '0002_repair_uploaded_by_column'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "ALTER TABLE gallery_galleryimage "
                "ADD COLUMN IF NOT EXISTS title varchar(255) NULL;"
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql=(
                "DO $$ BEGIN "
                "IF EXISTS ("
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='gallery_galleryimage' AND column_name='caption'"
                ") THEN "
                "UPDATE gallery_galleryimage "
                "SET title=COALESCE(NULLIF(caption, ''), 'Untitled') "
                "WHERE title IS NULL; "
                "ELSE "
                "UPDATE gallery_galleryimage "
                "SET title='Untitled' "
                "WHERE title IS NULL; "
                "END IF; "
                "END $$;"
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql=(
                "ALTER TABLE gallery_galleryimage "
                "ALTER COLUMN title SET NOT NULL;"
            ),
            reverse_sql=(
                "ALTER TABLE gallery_galleryimage "
                "ALTER COLUMN title DROP NOT NULL;"
            ),
        ),
    ]

