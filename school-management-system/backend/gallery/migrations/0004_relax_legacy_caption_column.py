# Legacy compatibility: old schemas may still have a required `caption` column.

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('gallery', '0003_repair_title_column'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "DO $$ BEGIN "
                "IF EXISTS ("
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='gallery_galleryimage' AND column_name='caption'"
                ") THEN "
                "ALTER TABLE gallery_galleryimage "
                "ALTER COLUMN caption DROP NOT NULL; "
                "ALTER TABLE gallery_galleryimage "
                "ALTER COLUMN caption SET DEFAULT ''; "
                "END IF; "
                "END $$;"
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]

