import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('announcements', '0001_initial'),
        ('communication', '0003_notification_related_exam'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='related_announcement',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='notifications',
                to='announcements.announcement',
            ),
        ),
    ]
