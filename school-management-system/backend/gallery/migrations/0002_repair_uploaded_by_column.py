# Manual repair migration for environments with drifted gallery schema.

from django.db import migrations

def run_repair_sql(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute("ALTER TABLE gallery_galleryimage ADD COLUMN IF NOT EXISTS uploaded_by_id bigint NULL;")
            cursor.execute("CREATE INDEX IF NOT EXISTS gallery_galleryimage_uploaded_by_id_idx ON gallery_galleryimage (uploaded_by_id);")
            cursor.execute("""
                DO $$ BEGIN 
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='accounts_user') THEN 
                IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname='gallery_galleryimage_uploaded_by_id_9e3655b8_fk_accounts_user_id'
                ) THEN 
                ALTER TABLE gallery_galleryimage 
                ADD CONSTRAINT gallery_galleryimage_uploaded_by_id_9e3655b8_fk_accounts_user_id 
                FOREIGN KEY (uploaded_by_id) REFERENCES accounts_user(id) 
                DEFERRABLE INITIALLY DEFERRED; 
                END IF; 
                END IF; 
                END $$;
            """)
    elif connection.vendor == 'sqlite':
        try:
            with connection.cursor() as cursor:
                columns = [col[0] for col in connection.introspection.get_table_description(cursor, 'gallery_galleryimage')]
            if 'uploaded_by_id' not in columns:
                with connection.cursor() as cursor:
                    cursor.execute("ALTER TABLE gallery_galleryimage ADD COLUMN uploaded_by_id integer NULL;")
            with connection.cursor() as cursor:
                cursor.execute("CREATE INDEX IF NOT EXISTS gallery_galleryimage_uploaded_by_id_idx ON gallery_galleryimage (uploaded_by_id);")
        except Exception:
            pass


class Migration(migrations.Migration):
    dependencies = [
        ('gallery', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(
            run_repair_sql,
            reverse_code=migrations.RunPython.noop,
        ),
    ]


