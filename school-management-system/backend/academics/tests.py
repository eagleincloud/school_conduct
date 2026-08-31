from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from classes.models import ClassSection, MainClass, MainSection
from tenants.models import School
from .models import Exam


class AcademicTenantIsolationTests(TestCase):
    def setUp(self):
        self.school_a = School.objects.create(name='School A', school_id='academic-a')
        self.school_b = School.objects.create(name='School B', school_id='academic-b')
        self.admin_a = User.objects.create_user(
            username='academic-admin-a', email='academic-admin-a@example.com',
            password='StrongPass!2026', role='admin', school=self.school_a,
        )
        class_b = MainClass.objects.create(school=self.school_b, name='10')
        section_b = MainSection.objects.create(school=self.school_b, name='A')
        self.class_section_b = ClassSection.objects.create(
            school=self.school_b, class_ref=class_b, section_ref=section_b,
        )
        self.exam_b = Exam.objects.create(
            name='Other School Exam', class_section=self.class_section_b,
            date=date(2026, 8, 18), start_date=date(2026, 8, 18), end_date=date(2026, 8, 18),
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin_a)

    def test_admin_cannot_delete_exam_from_another_school(self):
        response = self.client.delete(f'/api/academics/exams/{self.exam_b.id}/')

        self.assertEqual(response.status_code, 404)
        self.assertTrue(Exam.objects.filter(id=self.exam_b.id).exists())

    def test_admin_cannot_create_exam_for_another_school(self):
        response = self.client.post(
            '/api/academics/exams/',
            {
                'name': 'Cross Tenant Exam', 'class_section': self.class_section_b.id,
                'exam_type': 'unit_test', 'date': '2026-08-18',
                'start_date': '2026-08-18', 'end_date': '2026-08-18',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Exam.objects.filter(name='Cross Tenant Exam').exists())
