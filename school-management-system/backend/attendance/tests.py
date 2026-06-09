from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from attendance.models import BiometricDevice
from tenants.models import School


class BiometricDeviceApiTests(APITestCase):
    def setUp(self):
        self.school = School.objects.create(name='North Campus', school_id='NORTH')
        self.other_school = School.objects.create(name='South Campus', school_id='SOUTH')
        self.admin_user = User.objects.create_user(
            username='north-admin',
            password='pass1234',
            role='admin',
            school=self.school,
            email='north@example.com',
        )
        self.superadmin_user = User.objects.create_user(
            username='root-admin',
            password='pass1234',
            role='superadmin',
            email='root@example.com',
        )

    def test_admin_creates_device_in_own_school_scope(self):
        self.client.force_authenticate(self.admin_user)

        response = self.client.post(
            reverse('biometric-device-list-create'),
            {
                'school': self.other_school.school_id,
                'name': 'Main Gate',
                'device_ip': '192.168.0.50',
                'device_port': 4370,
                'machine_number': 1,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(BiometricDevice.objects.count(), 1)
        self.assertEqual(BiometricDevice.objects.first().school, self.school)

    def test_superadmin_filters_devices_by_school_code(self):
        device_one = BiometricDevice.objects.create(
            school=self.school,
            name='North Lobby',
            device_ip='192.168.0.10',
        )
        BiometricDevice.objects.create(
            school=self.other_school,
            name='South Lobby',
            device_ip='192.168.0.11',
        )

        self.client.force_authenticate(self.superadmin_user)
        response = self.client.get(reverse('biometric-device-list-create'), {'school': self.school.school_id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], device_one.id)
