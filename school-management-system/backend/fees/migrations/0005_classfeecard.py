from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0001_initial'),
        ('fees', '0004_remove_feestructure_fee_type'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ClassFeeCard',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('class_name', models.CharField(max_length=50)),
                ('registration_fee', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10)),
                ('admission_fee', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10)),
                ('tuition_fee', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10)),
                ('computer_fee', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10)),
                ('annual_charges', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10)),
                ('science_fee', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10)),
                ('sports_fee', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10)),
                ('total_fee', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_fee_cards', to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fee_cards', to='tenants.school')),
            ],
            options={
                'ordering': ['class_name'],
                'unique_together': {('school', 'class_name')},
            },
        ),
    ]
