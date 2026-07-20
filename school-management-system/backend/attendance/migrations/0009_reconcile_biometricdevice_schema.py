from django.db import migrations


def reconcile_biometricdevice_schema(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'attendance_biometricdevice'
            """
        )
        columns = {row[0] for row in cursor.fetchall()}

        if "device_serial_number" not in columns:
            cursor.execute(
                """
                ALTER TABLE attendance_biometricdevice
                ADD COLUMN device_serial_number varchar(100) NOT NULL DEFAULT ''
                """
            )
            columns.add("device_serial_number")

        if "integration_mode" not in columns:
            cursor.execute(
                """
                ALTER TABLE attendance_biometricdevice
                ADD COLUMN integration_mode varchar(20) NOT NULL DEFAULT 'bridge_pull'
                """
            )
            columns.add("integration_mode")

        if "terminal_id" not in columns:
            cursor.execute(
                """
                ALTER TABLE attendance_biometricdevice
                ADD COLUMN terminal_id varchar(100) NOT NULL DEFAULT ''
                """
            )
            columns.add("terminal_id")

        if "allowed_source_ip" not in columns:
            cursor.execute(
                """
                ALTER TABLE attendance_biometricdevice
                ADD COLUMN allowed_source_ip inet NULL
                """
            )
            columns.add("allowed_source_ip")

        if "last_event_type" not in columns:
            cursor.execute(
                """
                ALTER TABLE attendance_biometricdevice
                ADD COLUMN last_event_type varchar(50) NOT NULL DEFAULT ''
                """
            )
            columns.add("last_event_type")

        if "serial_number" in columns and "device_serial_number" in columns:
            cursor.execute(
                """
                UPDATE attendance_biometricdevice
                SET device_serial_number = COALESCE(NULLIF(device_serial_number, ''), serial_number, '')
                WHERE COALESCE(device_serial_number, '') = ''
                """
            )


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0008_rename_attendance_b_device__b3c6f7_idx_attendance__device__a47cac_idx_and_more"),
    ]

    operations = [
        migrations.RunPython(reconcile_biometricdevice_schema, migrations.RunPython.noop),
    ]
