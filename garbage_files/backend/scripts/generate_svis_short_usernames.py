import csv
from pathlib import Path

from django.contrib.auth import get_user_model

from accounts.utils import DEFAULT_STUDENT_PASSWORD, DEFAULT_TEACHER_PASSWORD, build_username_from_name_identifier
from students.models import StudentProfile
from teachers.models import TeacherProfile
from tenants.models import School


STUDENTS_OUT_PATH = Path(r"C:\Users\User\Desktop\school_conduct\svis_students_usernames.csv")
TEACHERS_OUT_PATH = Path(r"C:\Users\User\Desktop\school_conduct\svis_teachers_usernames.csv")
SCHOOL_ID = "SVIS"


def unique_username(base, used):
    username = base
    counter = 1
    while username in used:
        username = f"{base}{counter}"
        counter += 1
    used.add(username)
    return username


def main():
    User = get_user_model()
    school = School.objects.get(school_id=SCHOOL_ID)
    students = list(
        StudentProfile.objects.select_related(
            "user",
            "school",
            "class_section__class_ref",
            "class_section__section_ref",
        )
        .filter(school=school)
        .order_by("class_section__class_ref__name", "class_section__section_ref__name", "roll_number", "user__name", "id")
    )
    teachers = list(
        TeacherProfile.objects.select_related("user", "school")
        .filter(school=school)
        .order_by("employee_id", "user__name", "id")
    )

    selected_user_ids = {s.user_id for s in students} | {t.user_id for t in teachers}
    used = set(User.objects.exclude(id__in=selected_user_ids).values_list("username", flat=True))

    headers = [
        "School ID",
        "Role",
        "Name",
        "Identifier",
        "Class",
        "Section",
        "Roll Number",
        "Current Username",
        "New Username",
        "Password",
        "Email",
        "Phone",
    ]

    with STUDENTS_OUT_PATH.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(headers)

        for s in students:
            name = s.user.name or f"{s.user.first_name or ''} {s.user.last_name or ''}".strip() or s.user.username
            identifier = s.admission_number or f"STUDENT{s.id}"
            new_username = unique_username(
                build_username_from_name_identifier(name, identifier, fallback_role="student"),
                used,
            )
            writer.writerow([
                school.school_id,
                "Student",
                name,
                identifier,
                s.class_section.class_ref.name if s.class_section and s.class_section.class_ref else "",
                s.class_section.section_ref.name if s.class_section and s.class_section.section_ref else "",
                s.roll_number or "",
                s.user.username,
                new_username,
                DEFAULT_STUDENT_PASSWORD,
                s.user.email or "",
                s.father_contact or s.mother_contact or s.user.phone or "",
            ])

    with TEACHERS_OUT_PATH.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(headers)

        for t in teachers:
            name = t.user.name or t.user.username
            identifier = t.employee_id or f"TEACHER{t.id}"
            new_username = unique_username(
                build_username_from_name_identifier(name, identifier, fallback_role="teacher"),
                used,
            )
            writer.writerow([
                school.school_id,
                "Teacher",
                name,
                identifier,
                "",
                "",
                "",
                t.user.username,
                new_username,
                DEFAULT_TEACHER_PASSWORD,
                t.user.email or "",
                t.phone_number or t.user.phone or "",
            ])

    print(STUDENTS_OUT_PATH)
    print(TEACHERS_OUT_PATH)
    print(f"students={len(students)} teachers={len(teachers)} total={len(students) + len(teachers)}")


main()
