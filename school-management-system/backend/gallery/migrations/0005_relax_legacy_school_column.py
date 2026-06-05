# Legacy compatibility: old schemas may contain required `school_id`.

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('gallery', '0004_relax_legacy_caption_column'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "DO $$ BEGIN "
                "IF EXISTS ("
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='gallery_galleryimage' AND column_name='school_id'"
                ") THEN "
                "ALTER TABLE gallery_galleryimage "
                "ALTER COLUMN school_id DROP NOT NULL; "
                "END IF; "
                "END $$;"
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]

