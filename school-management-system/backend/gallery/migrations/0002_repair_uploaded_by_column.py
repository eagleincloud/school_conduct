# Manual repair migration for environments with drifted gallery schema.

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('gallery', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "ALTER TABLE gallery_galleryimage "
                "ADD COLUMN IF NOT EXISTS uploaded_by_id bigint NULL;"
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS gallery_galleryimage_uploaded_by_id_idx "
                "ON gallery_galleryimage (uploaded_by_id);"
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql=(
                "DO $$ BEGIN "
                "IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='accounts_user') THEN "
                "IF NOT EXISTS ("
                "SELECT 1 FROM pg_constraint "
                "WHERE conname='gallery_galleryimage_uploaded_by_id_9e3655b8_fk_accounts_user_id'"
                ") THEN "
                "ALTER TABLE gallery_galleryimage "
                "ADD CONSTRAINT gallery_galleryimage_uploaded_by_id_9e3655b8_fk_accounts_user_id "
                "FOREIGN KEY (uploaded_by_id) REFERENCES accounts_user(id) "
                "DEFERRABLE INITIALLY DEFERRED; "
                "END IF; "
                "END IF; "
                "END $$;"
            ),
            reverse_sql=(
                "ALTER TABLE gallery_galleryimage "
                "DROP CONSTRAINT IF EXISTS gallery_galleryimage_uploaded_by_id_9e3655b8_fk_accounts_user_id;"
            ),
        ),
    ]

