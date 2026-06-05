# Teacher profile photo (file) for ID card and display

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('teachers', '0003_teacher_documents'),
    ]

    operations = [
        migrations.AddField(
            model_name='teacherprofile',
            name='photo',
            field=models.ImageField(blank=True, null=True, upload_to='teacher_photos/'),
        ),
    ]
