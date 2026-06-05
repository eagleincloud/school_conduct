from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assignments', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='assignment',
            name='attachment',
            field=models.FileField(blank=True, null=True, upload_to='assignments/'),
        ),
        migrations.AddField(
            model_name='assignment',
            name='instructions',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='assignment',
            name='start_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='assignment',
            name='subject',
            field=models.CharField(default='General', max_length=120),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='assignment',
            name='submission_type',
            field=models.CharField(
                choices=[('online', 'Online'), ('offline', 'Offline')],
                default='online',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='assignment',
            name='total_marks',
            field=models.DecimalField(decimal_places=2, default=100, max_digits=7),
        ),
    ]

