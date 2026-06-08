# Manual repair migration for environments where an older gallery schema used `caption`.

from django.db import migrations

def run_repair_title_sql(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute("ALTER TABLE gallery_galleryimage ADD COLUMN IF NOT EXISTS title varchar(255) NULL;")
            cursor.execute("""
                DO $$ BEGIN 
                IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema='public' AND table_name='gallery_galleryimage' AND column_name='caption'
                ) THEN 
                UPDATE gallery_galleryimage 
                SET title=COALESCE(NULLIF(caption, ''), 'Untitled') 
                WHERE title IS NULL; 
                ELSE 
                UPDATE gallery_galleryimage 
                SET title='Untitled' 
                WHERE title IS NULL; 
                END IF; 
                END $$;
            """)
            cursor.execute("ALTER TABLE gallery_galleryimage ALTER COLUMN title SET NOT NULL;")
    elif connection.vendor == 'sqlite':
        try:
            with connection.cursor() as cursor:
                columns = [col[0] for col in connection.introspection.get_table_description(cursor, 'gallery_galleryimage')]
            if 'title' not in columns:
                with connection.cursor() as cursor:
                    cursor.execute("ALTER TABLE gallery_galleryimage ADD COLUMN title varchar(255) NOT NULL DEFAULT 'Untitled';")
            else:
                with connection.cursor() as cursor:
                    if 'caption' in columns:
                        cursor.execute("UPDATE gallery_galleryimage SET title=COALESCE(NULLIF(caption, ''), 'Untitled') WHERE title IS NULL;")
                    else:
                        cursor.execute("UPDATE gallery_galleryimage SET title='Untitled' WHERE title IS NULL;")
        except Exception:
            pass


class Migration(migrations.Migration):
    dependencies = [
        ('gallery', '0002_repair_uploaded_by_column'),
    ]

    operations = [
        migrations.RunPython(
            run_repair_title_sql,
            reverse_code=migrations.RunPython.noop,
        ),
    ]


