import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('classes', '0003_classsection_school_mainclass_school_and_more'),
        ('tenants', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Announcement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('type', models.CharField(
                    choices=[('holiday', 'Holiday'), ('exam', 'Exam'), ('general', 'General')],
                    default='holiday',
                    max_length=20,
                )),
                ('start_date', models.DateField()),
                ('end_date', models.DateField()),
                ('target_audience', models.CharField(
                    choices=[('all', 'All'), ('students', 'Students'), ('teachers', 'Teachers')],
                    default='all',
                    max_length=20,
                )),
                ('attachment', models.FileField(blank=True, null=True, upload_to='announcements/%Y/%m/')),
                ('is_important', models.BooleanField(default=False)),
                ('is_pinned', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('class_ref', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='announcements',
                    to='classes.mainclass',
                )),
                ('created_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='announcements_created',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('school', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='announcements',
                    to='tenants.school',
                )),
            ],
            options={
                'ordering': ['-is_pinned', '-is_important', '-created_at'],
            },
        ),
    ]
