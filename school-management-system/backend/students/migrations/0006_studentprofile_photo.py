# Generated manually for student profile photo upload

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0005_delete_admissionsequence'),
    ]

    operations = [
        migrations.AddField(
            model_name='studentprofile',
            name='photo',
            field=models.ImageField(blank=True, null=True, upload_to='student_photos/'),
        ),
    ]
