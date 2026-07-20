from django.db import migrations


def reconcile_biometriceventlog_schema(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_name = 'attendance_biometriceventlog'
            )
            """
        )
        table_exists = cursor.fetchone()[0]

        if not table_exists:
            cursor.execute(
                """
                CREATE TABLE attendance_biometriceventlog (
                    id bigserial PRIMARY KEY,
                    protocol varchar(20) NOT NULL,
                    status varchar(20) NOT NULL DEFAULT 'received',
                    event_fingerprint varchar(64) NOT NULL UNIQUE,
                    source_ip inet NULL,
                    device_serial_number varchar(100) NOT NULL DEFAULT '',
                    terminal_id varchar(100) NOT NULL DEFAULT '',
                    trans_id varchar(100) NOT NULL DEFAULT '',
                    event_type varchar(50) NOT NULL DEFAULT '',
                    user_identifier varchar(100) NOT NULL DEFAULT '',
                    attend_stat varchar(100) NOT NULL DEFAULT '',
                    verify_mode varchar(100) NOT NULL DEFAULT '',
                    punch_time timestamptz NULL,
                    raw_payload text NOT NULL DEFAULT '',
                    normalized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
                    error_message varchar(255) NOT NULL DEFAULT '',
                    received_at timestamptz NOT NULL DEFAULT now(),
                    processed_at timestamptz NULL,
                    attendance_id bigint NULL REFERENCES attendance_attendance(id) DEFERRABLE INITIALLY DEFERRED,
                    device_id bigint NULL REFERENCES attendance_biometricdevice(id) DEFERRABLE INITIALLY DEFERRED,
                    school_id bigint NULL REFERENCES tenants_school(id) DEFERRABLE INITIALLY DEFERRED,
                    teacher_attendance_id bigint NULL REFERENCES attendance_teacherattendance(id) DEFERRABLE INITIALLY DEFERRED
                )
                """
            )

        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS attendance_b_device__b3c6f7_idx
            ON attendance_biometriceventlog (device_serial_number, received_at DESC)
            """
        )
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS attendance_b_status_6352de_idx
            ON attendance_biometriceventlog (status, received_at DESC)
            """
        )
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS attendance_b_event_t_7b6691_idx
            ON attendance_biometriceventlog (event_type, received_at DESC)
            """
        )


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0009_reconcile_biometricdevice_schema"),
    ]

    operations = [
        migrations.RunPython(reconcile_biometriceventlog_schema, migrations.RunPython.noop),
    ]
