from django.test import TestCase
from rest_framework.test import APIClient

from tenants.models import School
from .models import User


class AccountAuthorizationTests(TestCase):
    def setUp(self):
        self.school_a = School.objects.create(name='School A', school_id='school-a')
        self.school_b = School.objects.create(name='School B', school_id='school-b')
        self.admin = User.objects.create_user(
            username='admin-a', email='admin-a@example.com', password='StrongPass!2026',
            role='admin', school=self.school_a,
        )
        self.student = User.objects.create_user(
            username='student-a', email='student-a@example.com', password='StrongPass!2026',
            role='student', school=self.school_a,
        )
        self.client = APIClient()

    def test_profile_update_cannot_change_role_or_school(self):
        self.client.force_authenticate(self.student)
        response = self.client.patch(
            '/api/auth/update-profile/',
            {'name': 'Updated Name', 'role': 'admin', 'school': self.school_b.id},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual(self.student.name, 'Updated Name')
        self.assertEqual(self.student.role, 'student')
        self.assertEqual(self.student.school_id, self.school_a.id)

    def test_school_admin_cannot_create_platform_role(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            '/api/auth/admin/create-user/',
            {
                'username': 'dealer-user', 'email': 'dealer@example.com',
                'password': 'StrongPass!2026', 'role': 'dealer',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username='dealer-user').exists())

    def test_school_admin_cannot_create_user_in_another_school(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            '/api/auth/admin/create-user/',
            {
                'username': 'teacher-b', 'email': 'teacher-b@example.com',
                'password': 'StrongPass!2026', 'role': 'teacher', 'school': self.school_b.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username='teacher-b').exists())

    def test_school_admin_creates_user_only_in_own_school(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            '/api/auth/admin/create-user/',
            {
                'username': 'teacher-a', 'email': 'teacher-a@example.com',
                'password': 'StrongPass!2026', 'role': 'teacher',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        created = User.objects.get(username='teacher-a')
        self.assertEqual(created.school_id, self.school_a.id)
        self.assertTrue(created.check_password('StrongPass!2026'))
