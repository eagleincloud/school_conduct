# Migration 0007: Add new columns and copy data from old columns.
# Old columns are NOT dropped here — that happens in 0008.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0006_studentprofile_photo'),
    ]

    operations = [
        migrations.AddField(
            model_name='studentprofile',
            name='father_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='studentprofile',
            name='mother_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='studentprofile',
            name='father_contact',
            field=models.CharField(blank=True, max_length=15, null=True),
        ),
        migrations.AddField(
            model_name='studentprofile',
            name='mother_contact',
            field=models.CharField(blank=True, max_length=15, null=True),
        ),
        migrations.AddField(
            model_name='studentprofile',
            name='bus_no',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
    ]
