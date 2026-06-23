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
    # Map alternate column names from various file formats to expected names for students
    STUDENT_COLUMN_ALIASES = {
        'student full name': 'name',
        'student full name.1': '_name_duplicate',  # skip duplicate name column
        'student name': 'name',
        'full name': 'name',
        'class ok': 'class',
        'class no': '_class_no',  # numeric class code, not used directly
        'sec ok': 'section',
        'section ms': '_section_display',  # display label like "I-A", not used directly
        'sr number': 'admission_no',
        'sr no': 'admission_no',
        'mobile': 'phone',
        'fathers name': 'father_name',
        'mothers name': 'mother_name',
        'mother mobile no.': 'mother_contact',
    }

    # Map alternate column names from various file formats to expected names for teachers
    TEACHER_COLUMN_ALIASES = {
        'name of staff': 'name',
        'teacher name': 'name',
        'full name': 'name',
        'designation': 'specialization',
        'specialization': 'specialization',
        'subject': 'specialization',
        'mobile': 'phone',
        'phone': 'phone',
        's. no.': 'employee_id',
        'employee id': 'employee_id',
    }

    @staticmethod
    def _clean_value(val):
        if pd.isna(val):
            return None
        if isinstance(val, float) and math.isnan(val):
            return None
        return str(val).strip()

    @staticmethod
    def _clean_phone(phone):
        if not phone:
            return None
        phone = str(phone).strip()
        for char in [',', '/', ';']:
            if char in phone:
                phone = phone.split(char)[0].strip()
        return phone[:15]

    @staticmethod
    def _apply_column_aliases(df, aliases):
        """Rename columns using the alias mapping (case-insensitive)."""
        rename_map = {}
        for col in df.columns:
            col_lower = str(col).lower().strip()
            if col_lower in aliases:
                rename_map[col] = aliases[col_lower]
        if rename_map:
            df = df.rename(columns=rename_map)
        return df

    @staticmethod
    def validate_file(file_obj, import_type, school):
        try:
            if file_obj.name.endswith('.csv'):
                df = pd.read_csv(file_obj)
            else:
                # Use header=2 for teacher excel files if it starts with extra headers,
                # otherwise standard header=0.
                if 'teacher' in import_type.lower() and not file_obj.name.endswith('.csv'):
                    try:
                        # Inspect the file first to check header position
                        df_preview = pd.read_excel(file_obj, nrows=3)
                        # If first column name starts with Unnamed or is NaN, it probably has header at row 2
                        if any(str(c).startswith('Unnamed') for c in df_preview.columns):
                            df = pd.read_excel(file_obj, header=2)
                        else:
                            df = pd.read_excel(file_obj)
                    except:
                        df = pd.read_excel(file_obj)
                else:
                    df = pd.read_excel(file_obj)
        except Exception as e:
            return None, [{"row": 0, "error": f"Invalid file format: {str(e)}"}]
        
        # Replace nan with None
        df = df.where(pd.notnull(df), None)

        # Standardize column headers (lowercase and strip)
        df.columns = [str(c).lower().strip() for c in df.columns]

        # Apply column aliases based on import type
        if import_type == 'student':
            df = BulkImportService._apply_column_aliases(df, BulkImportService.STUDENT_COLUMN_ALIASES)
            return BulkImportService.validate_students(df, school)
        elif import_type == 'teacher':
            df = BulkImportService._apply_column_aliases(df, BulkImportService.TEACHER_COLUMN_ALIASES)
            return BulkImportService.validate_teachers(df, school)
        else:
            return None, [{"row": 0, "error": "Invalid import type"}]

    @staticmethod
    def validate_students(df, school):
        valid_rows = []
        error_rows = []

        # Email is no longer strictly required — it will be auto-generated if missing
        required_cols = ['name', 'class', 'section']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            return None, [{"row": 0, "error": f"Missing required columns: {', '.join(missing)}"}]

        # Auto-generate emails if the column is missing entirely
        if 'email' not in df.columns:
            df['email'] = None

        # Prefetch data for validation
        existing_emails = df['email'].dropna().astype(str).tolist()
        emails_in_db = set(User.objects.filter(email__in=existing_emails).values_list('email', flat=True)) if existing_emails else set()
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
            phone = BulkImportService._clean_phone(row.get('phone')) if 'phone' in df.columns else None

            # Extra fields for student profile
            father_name = BulkImportService._clean_value(row.get('father_name')) if 'father_name' in df.columns else None
            mother_name = BulkImportService._clean_value(row.get('mother_name')) if 'mother_name' in df.columns else None
            address = BulkImportService._clean_value(row.get('address')) if 'address' in df.columns else None
            mother_contact = BulkImportService._clean_value(row.get('mother_contact')) if 'mother_contact' in df.columns else None
            father_contact = BulkImportService._clean_value(row.get('phone')) if 'phone' in df.columns else None

            if not name:
                errors.append("Name is required")

            # Auto-generate email if not provided
            if not email:
                if admission_no:
                    email = f"{admission_no}@svis.edu.in"
                else:
                    email = f"student.{row_num}.{get_random_string(4)}@svis.edu.in"

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
                    "admission_no": admission_no,
                    "name": name,
                    "username": username,
                    "email": email,
                    "class": class_name,
                    "section": section_name,
                    "roll_number": roll_number,
                    "phone": phone,
                    "father_name": father_name,
                    "mother_name": mother_name,
                    "address": address,
                    "father_contact": father_contact,
                    "mother_contact": mother_contact,
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

        # Email is optional — will be auto-generated if missing
        required_cols = ['name', 'specialization']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            return None, [{"row": 0, "error": f"Missing required columns: {', '.join(missing)}"}]

        # Auto-generate emails if the column is missing entirely
        if 'email' not in df.columns:
            df['email'] = None

        existing_emails = df['email'].dropna().astype(str).tolist()
        emails_in_db = set(User.objects.filter(email__in=existing_emails).values_list('email', flat=True)) if existing_emails else set()

        for index, row in df.iterrows():
            row_num = index + 2
            errors = []
            
            employee_id = BulkImportService._clean_value(row.get('employee_id')) if 'employee_id' in df.columns else None
            name = BulkImportService._clean_value(row.get('name'))
            specialization = BulkImportService._clean_value(row.get('specialization'))
            email = BulkImportService._clean_value(row.get('email'))
            phone = BulkImportService._clean_phone(row.get('phone')) if 'phone' in df.columns else None
            gender = BulkImportService._clean_value(row.get('gender')) if 'gender' in df.columns else None
            dob = BulkImportService._clean_value(row.get('dob')) if 'dob' in df.columns else None
            qualification = BulkImportService._clean_value(row.get('qualification')) if 'qualification' in df.columns else None
            experience_years = BulkImportService._clean_value(row.get('experience_years')) if 'experience_years' in df.columns else None
            joining_date = BulkImportService._clean_value(row.get('joining_date')) if 'joining_date' in df.columns else None

            if not name:
                errors.append("Name is required")

            # Auto-generate email if not provided
            if not email:
                emp_clean = employee_id
                if emp_clean and emp_clean.endswith('.0'):
                    emp_clean = emp_clean[:-2]
                if emp_clean:
                    email = f"teacher.{emp_clean}@svis.edu.in".lower().replace(" ", "")
                else:
                    email = f"teacher.{row_num}.{get_random_string(4)}@svis.edu.in"

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
        
        if import_type == 'student':
            try:
                from django.contrib.auth.hashers import make_password
                
                # Pre-fetch lookup maps
                cs_map = {}
                for cs in ClassSection.objects.filter(school=school).select_related('class_ref', 'section_ref'):
                    key = (cs.class_ref.name, cs.section_ref.name)
                    cs_map[key] = cs

                # Hashing one default password to reuse, avoiding slow hashing for every student
                default_password_hash = make_password("Student@123")

                # Batch users to create and profiles to create
                emails = [row.get('email') for row in valid_data if row.get('email')]
                existing_users = {u.email: u for u in User.objects.filter(email__in=emails)}
                existing_usernames = set(User.objects.values_list('username', flat=True))

                users_to_create = []
                profiles_to_create = []
                
                for row in valid_data:
                    email = row.get('email')
                    name = row.get('name')
                    phone = row.get('phone')
                    username = row.get('username')
                    
                    if not username:
                        username = email.split('@')[0] if email else f"user_{get_random_string(6)}"
                    
                    # Ensure username is unique in memory
                    while username in existing_usernames:
                        username = f"{username}_{get_random_string(4)}"
                    existing_usernames.add(username)

                    user = existing_users.get(email)
                    user_created = False
                    
                    if not user:
                        user = User(
                            email=email,
                            username=username,
                            name=name,
                            phone=phone,
                            role=import_type,
                            school=school,
                            password=default_password_hash
                        )
                        users_to_create.append(user)
                        user_created = True
                    
                    class_name = row.get('class')
                    section_name = row.get('section')
                    roll_number = row.get('roll_number')
                    admission_no = row.get('admission_no')
                    
                    if not admission_no:
                        admission_no = f"ADM-{school.id}-{get_random_string(6).upper()}"
                    
                    father_name = row.get('father_name')
                    mother_name = row.get('mother_name')
                    address_val = row.get('address')
                    father_contact = row.get('father_contact')
                    mother_contact = row.get('mother_contact')
                    
                    cs_key = (class_name, section_name)
                    class_section = cs_map.get(cs_key)
                    
                    profiles_to_create.append({
                        'user_obj': user,
                        'is_new_user': user_created,
                        'admission_number': admission_no,
                        'roll_number': roll_number,
                        'class_section': class_section,
                        'father_name': father_name,
                        'mother_name': mother_name,
                        'address': address_val,
                        'father_contact': father_contact,
                        'mother_contact': mother_contact,
                    })
                
                # Bulk create new users
                if users_to_create:
                    created_user_objs = User.objects.bulk_create(users_to_create, batch_size=200)
                    created_users.extend(created_user_objs)
                
                # Prefetch existing profiles for existing users to avoid duplicate DB insertions
                existing_profile_user_ids = set(StudentProfile.objects.filter(user__in=existing_users.values()).values_list('user_id', flat=True))

                student_profiles_to_create = []
                for pdata in profiles_to_create:
                    user_obj = pdata['user_obj']
                    # If user already existed, and they already have a profile, skip
                    if not pdata['is_new_user'] and user_obj.id in existing_profile_user_ids:
                        continue
                    
                    student_profiles_to_create.append(StudentProfile(
                        user=user_obj,
                        school=school,
                        admission_number=pdata['admission_number'],
                        roll_number=pdata['roll_number'],
                        class_section=pdata['class_section'],
                        father_name=pdata['father_name'],
                        mother_name=pdata['mother_name'],
                        address=pdata['address'],
                        father_contact=pdata['father_contact'],
                        mother_contact=pdata['mother_contact'],
                    ))
                
                if student_profiles_to_create:
                    StudentProfile.objects.bulk_create(student_profiles_to_create, batch_size=200)
                
                success_count = len(valid_data)
            except Exception as e:
                failed_count = len(valid_data)
                
        else:
            from django.contrib.auth.hashers import make_password
            default_password_hash = make_password("Teacher@123")
            
            for row in valid_data:
                try:
                    email = row.get('email')
                    name = row.get('name')
                    phone = row.get('phone')

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
                            'school': school,
                            'password': default_password_hash
                        }
                    )

                    if import_type == 'teacher':
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
                                'school': school,
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
