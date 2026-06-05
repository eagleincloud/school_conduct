import pandas as pd
from django.db import transaction
from django.contrib.auth import get_user_model
from django.utils.crypto import get_random_string
from students.models import StudentProfile
from teachers.models import TeacherProfile
from classes.models import MainClass, MainSection, ClassSection
from subjects.models import Subject
import math

User = get_user_model()

class BulkImportService:
    @staticmethod
    def _clean_value(val):
        if pd.isna(val):
            return None
        if isinstance(val, float) and math.isnan(val):
            return None
        return str(val).strip()

    @staticmethod
    def validate_file(file_obj, import_type, school):
        try:
            if file_obj.name.endswith('.csv'):
                df = pd.read_csv(file_obj)
            else:
                df = pd.read_excel(file_obj)
        except Exception as e:
            return None, [{"row": 0, "error": f"Invalid file format: {str(e)}"}]
        
        # Replace nan with None
        df = df.where(pd.notnull(df), None)

        # Standardize column headers (lowercase and strip)
        df.columns = [str(c).lower().strip() for c in df.columns]

        if import_type == 'student':
            return BulkImportService.validate_students(df, school)
        elif import_type == 'teacher':
            return BulkImportService.validate_teachers(df, school)
        else:
            return None, [{"row": 0, "error": "Invalid import type"}]

    @staticmethod
    def validate_students(df, school):
        valid_rows = []
        error_rows = []

        required_cols = ['name', 'email', 'class', 'section']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            return None, [{"row": 0, "error": f"Missing required columns: {', '.join(missing)}"}]

        # Prefetch data for validation
        emails_in_db = set(User.objects.filter(email__in=df['email'].dropna().astype(str)).values_list('email', flat=True))
        classes_in_db = {c.name for c in MainClass.objects.filter(school=school)}
        sections_in_db = {s.name for s in MainSection.objects.filter(school=school)}
        
        for index, row in df.iterrows():
            row_num = index + 2 # Excel row number (1-based + header)
            errors = []
            
            admission_no = BulkImportService._clean_value(row.get('admission_no')) if 'admission_no' in df.columns else None
            name = BulkImportService._clean_value(row.get('name'))
            username = BulkImportService._clean_value(row.get('username')) if 'username' in df.columns else None
            email = BulkImportService._clean_value(row.get('email'))
            class_name = BulkImportService._clean_value(row.get('class'))
            section_name = BulkImportService._clean_value(row.get('section'))
            roll_number = BulkImportService._clean_value(row.get('roll_number')) if 'roll_number' in df.columns else None
            phone = BulkImportService._clean_value(row.get('phone')) if 'phone' in df.columns else None

            if not name:
                errors.append("Name is required")
            if not email:
                errors.append("Email is required")
            else:
                if email in emails_in_db:
                    errors.append(f"Email {email} already exists")

            if not class_name:
                errors.append("Class is required")
            elif class_name not in classes_in_db:
                errors.append(f"Class '{class_name}' does not exist")

            if not section_name:
                errors.append("Section is required")
            elif section_name not in sections_in_db:
                errors.append(f"Section '{section_name}' does not exist")
                
            if roll_number and class_name in classes_in_db and section_name in sections_in_db:
                try:
                    cs = ClassSection.objects.get(class_ref__name=class_name, class_ref__school=school, section_ref__name=section_name, section_ref__school=school)
                    if StudentProfile.objects.filter(class_section=cs, roll_number=roll_number).exists():
                        errors.append(f"Roll number {roll_number} already exists in {class_name}-{section_name}")
                except ClassSection.DoesNotExist:
                    errors.append(f"Class Section mapping {class_name}-{section_name} does not exist")

            if errors:
                error_rows.append({"row": row_num, "error": ", ".join(errors)})
            else:
                valid_rows.append({
                    "name": name,
                    "email": email,
                    "class": class_name,
                    "section": section_name,
                    "roll_number": roll_number,
                    "phone": phone
                })
                emails_in_db.add(email) # Prevent duplicate emails in the same file from being completely valid
                
        return valid_rows, error_rows

    @staticmethod
    def validate_teachers(df, school):
        valid_rows = []
        error_rows = []

        # Allow either 'specialization' or 'subject' to support old templates
        if 'subject' in df.columns and 'specialization' not in df.columns:
            df.rename(columns={'subject': 'specialization'}, inplace=True)

        required_cols = ['name', 'email', 'specialization']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            return None, [{"row": 0, "error": f"Missing required columns: {', '.join(missing)}"}]

        emails_in_db = set(User.objects.filter(email__in=df['email'].dropna().astype(str)).values_list('email', flat=True))

        for index, row in df.iterrows():
            row_num = index + 2
            errors = []
            
            employee_id = BulkImportService._clean_value(row.get('employee_id')) if 'employee_id' in df.columns else None
            name = BulkImportService._clean_value(row.get('name'))
            specialization = BulkImportService._clean_value(row.get('specialization'))
            email = BulkImportService._clean_value(row.get('email'))
            phone = BulkImportService._clean_value(row.get('phone')) if 'phone' in df.columns else None
            gender = BulkImportService._clean_value(row.get('gender')) if 'gender' in df.columns else None
            dob = BulkImportService._clean_value(row.get('dob')) if 'dob' in df.columns else None
            qualification = BulkImportService._clean_value(row.get('qualification')) if 'qualification' in df.columns else None
            experience_years = BulkImportService._clean_value(row.get('experience_years')) if 'experience_years' in df.columns else None
            joining_date = BulkImportService._clean_value(row.get('joining_date')) if 'joining_date' in df.columns else None

            if not name:
                errors.append("Name is required")
            if not email:
                errors.append("Email is required")
            else:
                if email in emails_in_db:
                    errors.append(f"Email {email} already exists")

            if errors:
                error_rows.append({"row": row_num, "error": ", ".join(errors)})
            else:
                valid_rows.append({
                    "employee_id": employee_id,
                    "name": name,
                    "specialization": specialization,
                    "email": email,
                    "phone": phone,
                    "gender": gender,
                    "dob": dob,
                    "qualification": qualification,
                    "experience_years": experience_years,
                    "joining_date": joining_date
                })
                emails_in_db.add(email)
                
        return valid_rows, error_rows

    @staticmethod
    @transaction.atomic
    def confirm_import(valid_data, import_type, school):
        success_count = 0
        failed_count = 0
        created_users = []
        
        for row in valid_data:
            try:
                email = row.get('email')
                name = row.get('name')
                phone = row.get('phone')
                password = get_random_string(10) + 'A1!'

                # If username is provided, use it, otherwise fallback to email prefix or email
                username = row.get('username')
                if not username:
                    username = email.split('@')[0] if email else f"user_{get_random_string(6)}"
                    
                # Ensure username is unique
                if User.objects.exclude(email=email).filter(username=username).exists():
                    username = f"{username}_{get_random_string(4)}"

                user, created = User.objects.get_or_create(
                    email=email,
                    defaults={
                        'username': username,
                        'name': name,
                        'phone': phone,
                        'role': import_type,
                        'school': school
                    }
                )
                if created:
                    user.set_password(password)
                    user.save()

                if import_type == 'student':
                    class_name = row.get('class')
                    section_name = row.get('section')
                    roll_number = row.get('roll_number')
                    admission_no = row.get('admission_no')
                    
                    class_ref = MainClass.objects.get(name=class_name, school=school)
                    section_ref = MainSection.objects.get(name=section_name, school=school)
                    class_section = ClassSection.objects.get(class_ref=class_ref, section_ref=section_ref, school=school)
                    
                    if not admission_no:
                        admission_no = f"ADM-{school.id}-{get_random_string(6).upper()}"
                    
                    StudentProfile.objects.create(
                        user=user,
                        admission_number=admission_no,
                        roll_number=roll_number,
                        class_section=class_section,
                    )
                elif import_type == 'teacher':
                    subject_name = row.get('specialization')
                    emp_id = row.get('employee_id')
                    gender = row.get('gender')
                    dob = row.get('dob')
                    qualification = row.get('qualification')
                    experience_years = row.get('experience_years')
                    joining_date = row.get('joining_date')
                    
                    if not emp_id:
                        emp_id = f"EMP-{school.id}-{get_random_string(6).upper()}"
                    
                    try:
                        exp_years_int = int(float(experience_years)) if experience_years else None
                    except ValueError:
                        exp_years_int = None
                        
                    # dob and joining_date usually come as string, we pass them directly 
                    # assuming standard YYYY-MM-DD or letting Django parse them if possible. Let's gracefully handle them.
                    try:
                        if dob and isinstance(dob, str):
                            pd.to_datetime(dob).date() # simple validation
                    except:
                        dob = None
                        
                    try:
                        if joining_date and isinstance(joining_date, str):
                            pd.to_datetime(joining_date).date()
                    except:
                        joining_date = None
                    
                    teacher_profile, created_profile = TeacherProfile.objects.get_or_create(
                        user=user,
                        defaults={
                            'employee_id': emp_id,
                            'subject_specialization': subject_name,
                            'phone_number': phone,
                            'gender': gender,
                            'dob': dob if dob else None,
                            'qualification': qualification,
                            'experience_years': exp_years_int,
                            'joining_date': joining_date if joining_date else None,
                        }
                    )
                    
                    if created_profile and subject_name:
                        # Link to subjects if needed
                        subjects = Subject.objects.filter(school=school, name=subject_name)
                        for subject in subjects:
                            subject.teachers.add(teacher_profile)

                if created:
                    created_users.append(user)

                success_count += 1
            except Exception as e:
                failed_count += 1
                
        return success_count, failed_count, created_users
