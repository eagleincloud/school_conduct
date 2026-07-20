import csv
from pathlib import Path

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.db import transaction

from tenants.models import School


CSV_PATH = Path(r"C:\Users\User\Desktop\school_conduct\svis_teachers_usernames.csv")
BACKUP_PATH = Path(r"C:\Users\User\Desktop\school_conduct\svis_teacher_username_update_backup.csv")
SCHOOL_ID = "SVIS"


def normalize_role(role):
    return (role or "").strip().lower()


def load_rows():
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def main(apply=False):
    User = get_user_model()
    rows = load_rows()
    school = School.objects.get(school_id=SCHOOL_ID)

    if not rows:
        raise RuntimeError(f"No rows found in {CSV_PATH}")

    new_usernames = [row["New Username"].strip() for row in rows]
    if len(new_usernames) != len(set(new_usernames)):
        duplicates = sorted({u for u in new_usernames if new_usernames.count(u) > 1})
        raise RuntimeError(f"Duplicate new usernames in CSV: {duplicates[:10]}")

    targets = []
    missing = []
    for row in rows:
        role = normalize_role(row["Role"])
        current_username = row["Current Username"].strip()
        new_username = row["New Username"].strip()
        user = User.objects.filter(
            username=current_username,
            school=school,
            role=role,
        ).first()
        if not user:
            user = User.objects.filter(
                username=new_username,
                school=school,
                role=role,
            ).first()
        if not user:
            missing.append((role, current_username, new_username, row["Name"]))
            continue
        targets.append((user, row))

    if missing:
        preview = "; ".join(f"{role}:{current}->{new} ({name})" for role, current, new, name in missing[:10])
        raise RuntimeError(f"Could not find {len(missing)} users from CSV. First missing: {preview}")

    target_ids = {user.id for user, _ in targets}
    conflicts = list(
        User.objects.filter(username__in=new_usernames)
        .exclude(id__in=target_ids)
        .values_list("username", flat=True)
        .order_by("username")[:20]
    )
    if conflicts:
        raise RuntimeError(f"New username conflicts with non-target users: {conflicts}")

    current_usernames = {user.username for user, _ in targets}
    overlap = sorted((set(new_usernames) & current_usernames) - {row["Current Username"].strip() for _, row in targets if row["Current Username"].strip() == row["New Username"].strip()})
    if overlap:
        raise RuntimeError(f"New usernames overlap existing target usernames; use a two-phase update: {overlap[:20]}")

    print(f"CSV rows: {len(rows)}")
    print(f"Target users found: {len(targets)}")
    print(f"School: {school.name} ({school.school_id})")

    if not apply:
        print("DRY RUN ONLY: no database changes made.")
        return

    with BACKUP_PATH.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["User ID", "Role", "Name", "Old Username", "New Username", "Email"])
        for user, row in targets:
            writer.writerow([
                user.id,
                user.role,
                user.name or row["Name"],
                user.username,
                row["New Username"].strip(),
                user.email or "",
            ])

    password_hashes = {
        password: make_password(password)
        for password in {row["Password"].strip() for _, row in targets if row["Password"].strip()}
    }

    updated = 0
    batch_size = 25
    for start in range(0, len(targets), batch_size):
        batch = targets[start:start + batch_size]
        with transaction.atomic():
            for user, row in batch:
                new_username = row["New Username"].strip()
                password = row["Password"].strip()
                update_values = {"username": new_username}
                if password:
                    update_values["password"] = password_hashes[password]
                User.objects.filter(pk=user.pk).update(**update_values)
                updated += 1
        print(f"Updated {updated}/{len(targets)}")

    print(f"Updated users: {updated}")
    print(f"Backup written: {BACKUP_PATH}")


main(apply=globals().get("APPLY", False))
