from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('teachers', '0002_teacherprofile_dob_teacherprofile_experience_years_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='TeacherDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(blank=True, null=True, upload_to='teacher_documents/')),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('teacher', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='documents', to='teachers.teacherprofile')),
            ],
        ),
    ]

