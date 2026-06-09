import attendance.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0004_biometricdevice'),
    ]

    operations = [
        migrations.AddField(
            model_name='biometricdevice',
            name='bridge_server_url',
            field=models.URLField(blank=True, help_text='Optional override for the punch API endpoint used by this machine bridge.'),
        ),
        migrations.AddField(
            model_name='biometricdevice',
            name='device_type',
            field=models.CharField(choices=[('fingerprint', 'Fingerprint'), ('rfid', 'RFID'), ('hybrid', 'Hybrid')], default='hybrid', max_length=20),
        ),
        migrations.AddField(
            model_name='biometricdevice',
            name='last_punch_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='biometricdevice',
            name='last_seen_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='biometricdevice',
            name='last_test_message',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='biometricdevice',
            name='last_test_status',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='biometricdevice',
            name='last_tested_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='biometricdevice',
            name='notes',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='biometricdevice',
            name='site_label',
            field=models.CharField(blank=True, help_text='e.g. North Gate, Admin Block', max_length=120),
        ),
        migrations.AlterField(
            model_name='biometricdevice',
            name='device_secret_key',
            field=models.CharField(default=attendance.models.generate_device_secret_key, max_length=255),
        ),
        migrations.AlterModelOptions(
            name='biometricdevice',
            options={'ordering': ['school__name', 'name', 'id']},
        ),
    ]
