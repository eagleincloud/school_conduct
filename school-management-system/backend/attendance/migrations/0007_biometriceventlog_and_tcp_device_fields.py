from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0006_teacherattendance'),
        ('tenants', '0007_alter_school_hero_image_alter_school_logo'),
    ]

    operations = [
        migrations.AddField(
            model_name='biometricdevice',
            name='allowed_source_ip',
            field=models.GenericIPAddressField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='biometricdevice',
            name='device_serial_number',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='biometricdevice',
            name='integration_mode',
            field=models.CharField(
                choices=[('bridge_pull', 'Bridge Pull'), ('tcp_xml_push', 'TCP XML Push'), ('http_push', 'HTTP Push')],
                default='bridge_pull',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='biometricdevice',
            name='last_event_type',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='biometricdevice',
            name='terminal_id',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.CreateModel(
            name='BiometricEventLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('protocol', models.CharField(choices=[('http', 'HTTP'), ('tcp_xml', 'TCP XML')], max_length=20)),
                ('status', models.CharField(choices=[('received', 'Received'), ('processed', 'Processed'), ('duplicate', 'Duplicate'), ('ignored', 'Ignored'), ('unmatched', 'Unmatched'), ('unauthorized', 'Unauthorized'), ('failed', 'Failed')], default='received', max_length=20)),
                ('event_fingerprint', models.CharField(max_length=64, unique=True)),
                ('source_ip', models.GenericIPAddressField(blank=True, null=True)),
                ('device_serial_number', models.CharField(blank=True, max_length=100)),
                ('terminal_id', models.CharField(blank=True, max_length=100)),
                ('trans_id', models.CharField(blank=True, max_length=100)),
                ('event_type', models.CharField(blank=True, max_length=50)),
                ('user_identifier', models.CharField(blank=True, max_length=100)),
                ('attend_stat', models.CharField(blank=True, max_length=100)),
                ('verify_mode', models.CharField(blank=True, max_length=100)),
                ('punch_time', models.DateTimeField(blank=True, null=True)),
                ('raw_payload', models.TextField(blank=True)),
                ('normalized_payload', models.JSONField(blank=True, default=dict)),
                ('error_message', models.CharField(blank=True, default='', max_length=255)),
                ('received_at', models.DateTimeField(auto_now_add=True)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('attendance', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='biometric_event_logs', to='attendance.attendance')),
                ('device', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='event_logs', to='attendance.biometricdevice')),
                ('school', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='biometric_event_logs', to='tenants.school')),
                ('teacher_attendance', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='biometric_event_logs', to='attendance.teacherattendance')),
            ],
            options={
                'ordering': ['-received_at'],
            },
        ),
        migrations.AddIndex(
            model_name='biometriceventlog',
            index=models.Index(fields=['device_serial_number', 'received_at'], name='attendance_b_device__b3c6f7_idx'),
        ),
        migrations.AddIndex(
            model_name='biometriceventlog',
            index=models.Index(fields=['status', 'received_at'], name='attendance_b_status_6352de_idx'),
        ),
        migrations.AddIndex(
            model_name='biometriceventlog',
            index=models.Index(fields=['event_type', 'received_at'], name='attendance_b_event_t_7b6691_idx'),
        ),
    ]
