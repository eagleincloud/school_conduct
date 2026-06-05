import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0001_initial'),
        ('communication', '0002_message_attachments_and_read'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='related_exam',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='notifications',
                to='academics.exam',
            ),
        ),
    ]
