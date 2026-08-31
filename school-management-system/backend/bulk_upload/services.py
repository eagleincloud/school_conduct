import pandas as pd
import re
import math
from django.db import transaction
from django.contrib.auth import get_user_model
from django.utils.crypto import get_random_string
from students.models import StudentProfile
from teachers.models import TeacherProfile
from classes.models import MainClass, MainSection, ClassSection
from subjects.models import Subject

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
        'standard': 'class',
        'std': 'class',
        'grade': 'class',
        'sec ok': 'section',
        'sec': 'section',
        'section ms': '_section_display',  # display label like "I-A", not used directly
        'sr number': 'admission_no',
        'sr no': 'admission_no',
        'sr. no.': 'admission_no',
        's. no.': 'admission_no',
        'admission no': 'admission_no',
        'admission no.': 'admission_no',
        'admission number': 'admission_no',
        'mobile': 'phone',
        'phone': 'phone',
        'mobile no': 'phone',
        'mobile no.': 'phone',
        'contact': 'phone',
        'contact no': 'phone',
        'contact no.': 'phone',
        'fathers name': 'father_name',
        'father name': 'father_name',
        'father\'s name': 'father_name',
        'father’s name': 'father_name',
        'father`s name': 'father_name',
        'fathers’ name': 'father_name',
        'father': 'father_name',
        'father full name': 'father_name',
        'name of father': 'father_name',
        'father_name': 'father_name',
        'f name': 'father_name',
        'f. name': 'father_name',
        'f.name': 'father_name',
        'mothers name': 'mother_name',
        'mother name': 'mother_name',
        'mother\'s name': 'mother_name',
        'mother’s name': 'mother_name',
        'mother`s name': 'mother_name',
        'mothers’ name': 'mother_name',
        'mother': 'mother_name',
        'mother full name': 'mother_name',
        'name of mother': 'mother_name',
        'mother_name': 'mother_name',
        'm name': 'mother_name',
        'm. name': 'mother_name',
        'm.name': 'mother_name',
        'mother mobile no.': 'mother_contact',
        'mother mobile no': 'mother_contact',
        'mother mobile': 'mother_contact',
        'mother contact': 'mother_contact',
        'address': 'address',
        'dob': 'dob',
        'date of birth': 'dob',
        'd.o.b.': 'dob',
        'd.o.b': 'dob',
        'birth date': 'dob',
        'birthdate': 'dob',
        'punch': 'rfid_code',
        'punch no': 'rfid_code',
        'punch no.': 'rfid_code',
        'punch number': 'rfid_code',
        'punch code': 'rfid_code',
        'punch id': 'rfid_code',
        'card no': 'rfid_code',
        'card no.': 'rfid_code',
        'card number': 'rfid_code',
        'rfid': 'rfid_code',
        'rfid no': 'rfid_code',
        'rfid no.': 'rfid_code',
        'rfid code': 'rfid_code',
        'biometric id': 'rfid_code',
        'device id': 'rfid_code',
    }

    # Map alternate column names from various file formats to expected names for teachers
    TEACHER_COLUMN_ALIASES = {
        'name of staff': 'name',
        'teacher name': 'name',
        'full name': 'name',
        'staff name': 'name',
        'faculty name': 'name',
        'designation': 'specialization',
        'specialization': 'specialization',
        'subject': 'specialization',
        'mobile': 'phone',
        'phone': 'phone',
        'contact': 'phone',
        'contact no': 'phone',
        'contact no.': 'phone',
        'mobile no': 'phone',
        'mobile no.': 'phone',
        'mobile number': 'phone',
        'phone no': 'phone',
        'phone no.': 'phone',
        'phone number': 'phone',
        's. no.': 'employee_id',
        'sr no': 'employee_id',
        'sr. no.': 'employee_id',
        's no': 'employee_id',
        'employee id': 'employee_id',
        'emp id': 'employee_id',
        'address': 'address',
        'permanent address': 'address',
        'current address': 'address',
        'residence': 'address',
        'dob': 'dob',
        'date of birth': 'dob',
        'd.o.b.': 'dob',
        'd.o.b': 'dob',
        'birth date': 'dob',
        'birthdate': 'dob',
        'punch': 'rfid_code',
        'punch no': 'rfid_code',
        'punch no.': 'rfid_code',
        'punch number': 'rfid_code',
        'punch code': 'rfid_code',
        'punch id': 'rfid_code',
        'card no': 'rfid_code',
        'card no.': 'rfid_code',
        'card number': 'rfid_code',
        'rfid': 'rfid_code',
        'rfid no': 'rfid_code',
        'rfid no.': 'rfid_code',
        'rfid code': 'rfid_code',
        'biometric id': 'rfid_code',
        'device id': 'rfid_code',
    }

    @staticmethod
    def _clean_value(val):
        if val is None or pd.isna(val):
            return None
        if isinstance(val, float) and math.isnan(val):
            return None
        s = str(val).strip()
        if s.endswith('.0'):
            try:
                if float(s).is_integer():
                    s = str(int(float(s)))
            except:
                pass
        return s if s else None

    @staticmethod
    def _clean_first_name(name_str, fallback="user"):
        if not name_str:
            return fallback
        import re
        # Remove common prefixes/honorifics requiring dot or whitespace (e.g. Dr., Mr., Mrs., Ms. )
        cleaned = re.sub(r'^(mrs|miss|master|prof|dr|mr|ms)(\.|\s+)\s*', '', str(name_str).strip(), flags=re.IGNORECASE)
        parts = cleaned.split()
        first_word = parts[0] if parts else fallback
        alphanumeric = re.sub(r'[^a-zA-Z0-9]', '', first_word).lower()
        return alphanumeric if alphanumeric else fallback

    @staticmethod
    def _extract_birth_year(dob_val):
        if not dob_val:
            return None
        import re
        m = re.search(r'(19\d\d|20\d\d)', str(dob_val))
        if m:
            return m.group(1)
        return None

    @staticmethod
    def _clean_phone(phone):
        if phone is None or pd.isna(phone):
            return None
        phone = str(phone).strip()
        for char in [',', '/', ';']:
            if char in phone:
                phone = phone.split(char)[0].strip()
        if phone.endswith('.0'):
            phone = phone[:-2]
        try:
            if '.' in phone and float(phone).is_integer():
                phone = str(int(float(phone)))
        except:
            pass
        return phone[:15] if phone else None

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
    def _read_excel_smart(file_obj):
        """Read excel file, automatically detecting header row if top rows contain titles."""
        # First try standard header=0
        try:
            df = pd.read_excel(file_obj)
        except Exception:
            file_obj.seek(0)
            df = pd.read_excel(file_obj, engine='openpyxl')

        # Check if first row is likely a header, or if headers start further down
        cols_lower = [str(c).lower().strip() for c in df.columns]
        known_keywords = ['name', 'student', 'staff', 'teacher', 'sr', 's.no', 'roll', 'class', 'sec', 'mobile', 'phone', 'email', 'emp']
        has_known = any(any(kw in c for kw in known_keywords) for c in cols_lower)

        if not has_known or any(c.startswith('unnamed') for c in cols_lower[:2]):
            # Try reading first 5 rows to locate header row
            for header_idx in range(1, 6):
                try:
                    file_obj.seek(0)
                    df_try = pd.read_excel(file_obj, header=header_idx)
                    try_cols = [str(c).lower().strip() for c in df_try.columns]
                    if any(any(kw in c for kw in known_keywords) for c in try_cols):
                        df = df_try
                        break
                except Exception:
                    continue

        return df

    @staticmethod
    def validate_file(file_obj, import_type, school):
        try:
            if file_obj.name.endswith('.csv'):
                df = pd.read_csv(file_obj)
            else:
                df = BulkImportService._read_excel_smart(file_obj)
        except Exception as e:
            return None, [{"row": 0, "error": f"Invalid file format: {str(e)}"}]
        
        # Replace nan with None
        df = df.where(pd.notnull(df), None)

        # Standardize column headers (lowercase and strip)
        df.columns = [str(c).lower().strip() for c in df.columns]

        # Apply column aliases based on import type
        if import_type == 'student':
            df = BulkImportService._apply_column_aliases(df, BulkImportService.STUDENT_COLUMN_ALIASES)
            # Deduplicate columns (keep first if duplicate names exist)
            df = df.loc[:, ~df.columns.duplicated(keep='first')]
            return BulkImportService.validate_students(df, school)
        elif import_type == 'teacher':
            df = BulkImportService._apply_column_aliases(df, BulkImportService.TEACHER_COLUMN_ALIASES)
            # Deduplicate columns
            df = df.loc[:, ~df.columns.duplicated(keep='first')]
            return BulkImportService.validate_teachers(df, school)
        else:
            return None, [{"row": 0, "error": "Invalid import type"}]

    @staticmethod
    def validate_students(df, school):
        valid_rows = []
        error_rows = []

        # Only 'name' is strictly required — other columns default to null if missing
        required_cols = ['name']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            return None, [{"row": 0, "error": f"Missing required columns: {', '.join(missing)}"}]

        # Add missing optional columns with None defaults
        for optional_col in ['class', 'section', 'email', 'phone', 'admission_no', 'roll_number',
                             'father_name', 'mother_name', 'address', 'mother_contact', 'username', 'rfid_code']:
            if optional_col not in df.columns:
                df[optional_col] = None

        # Prefetch data for validation
        existing_emails = df['email'].dropna().astype(str).tolist()
        emails_in_db = set(User.objects.filter(email__in=existing_emails).values_list('email', flat=True)) if existing_emails else set()
        classes_in_db = {c.name for c in MainClass.objects.filter(school=school)}
        sections_in_db = {s.name for s in MainSection.objects.filter(school=school)}
        rfids_in_db = set(StudentProfile.objects.filter(school=school, rfid_code__isnull=False).values_list('rfid_code', flat=True))
        seen_rfids_in_file = set()
        
        for index, row in df.iterrows():
            row_num = index + 2 # Excel row number (1-based + header)
            errors = []
            
            admission_no = BulkImportService._clean_value(row.get('admission_no')) if 'admission_no' in df.columns else None
            name = BulkImportService._clean_value(row.get('name'))
            dob_val = BulkImportService._clean_value(row.get('dob')) if 'dob' in df.columns else None
            username = BulkImportService._clean_value(row.get('username')) if 'username' in df.columns else None
            email = BulkImportService._clean_value(row.get('email'))
            class_name = BulkImportService._clean_value(row.get('class'))
            section_name = BulkImportService._clean_value(row.get('section'))
            if class_name and (not section_name or str(section_name).strip() in ['', '-', 'None', 'nan']):
                section_name = 'A'
            roll_number = BulkImportService._clean_value(row.get('roll_number')) if 'roll_number' in df.columns else None
            phone = BulkImportService._clean_phone(row.get('phone')) if 'phone' in df.columns else None
            rfid_code = BulkImportService._clean_value(row.get('rfid_code')) if 'rfid_code' in df.columns else None
            if rfid_code and rfid_code.endswith('.0'):
                rfid_code = rfid_code[:-2]

            # Extra fields for student profile
            father_name = BulkImportService._clean_value(row.get('father_name')) if 'father_name' in df.columns else None
            mother_name = BulkImportService._clean_value(row.get('mother_name')) if 'mother_name' in df.columns else None
            address = BulkImportService._clean_value(row.get('address')) if 'address' in df.columns else None
            mother_contact = BulkImportService._clean_phone(row.get('mother_contact')) if 'mother_contact' in df.columns else None
            father_contact = phone

            if not name:
                errors.append("Name is required")

            # Generate student username: first_name + birth_year (fallback: first_name + admission_no)
            first_name = BulkImportService._clean_first_name(name, fallback="student")
            birth_year = BulkImportService._extract_birth_year(dob_val)
            if not username:
                if birth_year:
                    username = f"{first_name}{birth_year}"
                elif admission_no:
                    adm_clean = re.sub(r'[^a-zA-Z0-9]', '', str(admission_no)).lower()
                    username = f"{first_name}{adm_clean}"
                else:
                    username = f"{first_name}{row_num}"

            # Auto-generate email if not provided
            if not email:
                school_domain = f"{school.school_id.lower()}.edu.in" if getattr(school, 'school_id', None) else "school.edu.in"
                if admission_no:
                    email = f"{admission_no}@{school_domain}"
                else:
                    email = f"{username}@{school_domain}"

            if email in emails_in_db:
                errors.append(f"Email {email} already exists")

            # RFID / Punch code validation
            if rfid_code:
                if rfid_code in rfids_in_db:
                    errors.append(f"Punch/RFID code '{rfid_code}' already exists in database")
                elif rfid_code in seen_rfids_in_file:
                    errors.append(f"Duplicate Punch/RFID code '{rfid_code}' in file")
                else:
                    seen_rfids_in_file.add(rfid_code)

            # Classes and sections will be auto-created during import if they don't exist
            if roll_number and class_name and section_name:
                try:
                    cs = ClassSection.objects.get(class_ref__name=class_name, class_ref__school=school, section_ref__name=section_name, section_ref__school=school)
                    if StudentProfile.objects.filter(class_section=cs, roll_number=roll_number).exists():
                        errors.append(f"Roll number {roll_number} already exists in {class_name}-{section_name}")
                except ClassSection.DoesNotExist:
                    pass  # Will be auto-created during import

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
                    "rfid_code": rfid_code,
                    "dob": dob_val,
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

        # Only 'name' is strictly required
        required_cols = ['name']
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            return None, [{"row": 0, "error": f"Missing required columns: {', '.join(missing)}"}]

        # Add missing optional columns with None defaults
        for optional_col in ['specialization', 'email', 'phone', 'employee_id', 'gender',
                             'dob', 'qualification', 'experience_years', 'joining_date', 'address', 'rfid_code', 'username']:
            if optional_col not in df.columns:
                df[optional_col] = None

        existing_emails = df['email'].dropna().astype(str).tolist()
        emails_in_db = set(User.objects.filter(email__in=existing_emails).values_list('email', flat=True)) if existing_emails else set()
        rfids_in_db = set(TeacherProfile.objects.filter(school=school, rfid_code__isnull=False).values_list('rfid_code', flat=True))
        seen_rfids_in_file = set()

        for index, row in df.iterrows():
            row_num = index + 2
            errors = []
            
            employee_id = BulkImportService._clean_value(row.get('employee_id')) if 'employee_id' in df.columns else None
            name = BulkImportService._clean_value(row.get('name'))
            username = BulkImportService._clean_value(row.get('username')) if 'username' in df.columns else None
            specialization = BulkImportService._clean_value(row.get('specialization'))
            email = BulkImportService._clean_value(row.get('email'))
            phone = BulkImportService._clean_phone(row.get('phone')) if 'phone' in df.columns else None
            gender = BulkImportService._clean_value(row.get('gender')) if 'gender' in df.columns else None
            dob = BulkImportService._clean_value(row.get('dob')) if 'dob' in df.columns else None
            qualification = BulkImportService._clean_value(row.get('qualification')) if 'qualification' in df.columns else None
            experience_years = BulkImportService._clean_value(row.get('experience_years')) if 'experience_years' in df.columns else None
            joining_date = BulkImportService._clean_value(row.get('joining_date')) if 'joining_date' in df.columns else None
            address = BulkImportService._clean_value(row.get('address')) if 'address' in df.columns else None
            rfid_code = BulkImportService._clean_value(row.get('rfid_code')) if 'rfid_code' in df.columns else None
            if rfid_code and rfid_code.endswith('.0'):
                rfid_code = rfid_code[:-2]

            if not name:
                errors.append("Name is required")

            # Generate teacher username: first_name + employee_id (e.g. namrata101)
            first_name = BulkImportService._clean_first_name(name, fallback="teacher")
            emp_clean = re.sub(r'[^a-zA-Z0-9]', '', str(employee_id)).lower() if employee_id else str(row_num)
            if emp_clean.endswith('0') and '.' in str(employee_id):
                emp_clean = emp_clean[:-1]
            if not username:
                username = f"{first_name}{emp_clean}"

            # Auto-generate email if not provided
            if not email:
                school_domain = f"{school.school_id.lower()}.edu.in" if getattr(school, 'school_id', None) else "school.edu.in"
                emp_clean_email = employee_id
                if emp_clean_email and emp_clean_email.endswith('.0'):
                    emp_clean_email = emp_clean_email[:-2]
                if emp_clean_email:
                    email = f"teacher.{emp_clean_email}@{school_domain}".lower().replace(" ", "")
                else:
                    email = f"{username}@{school_domain}"

            if email in emails_in_db:
                errors.append(f"Email {email} already exists")

            # RFID / Punch code validation
            if rfid_code:
                if rfid_code in rfids_in_db:
                    errors.append(f"Punch/RFID code '{rfid_code}' already exists in database")
                elif rfid_code in seen_rfids_in_file:
                    errors.append(f"Duplicate Punch/RFID code '{rfid_code}' in file")
                else:
                    seen_rfids_in_file.add(rfid_code)

            if errors:
                error_rows.append({"row": row_num, "error": ", ".join(errors)})
            else:
                valid_rows.append({
                    "employee_id": employee_id,
                    "name": name,
                    "username": username,
                    "specialization": specialization,
                    "email": email,
                    "phone": phone,
                    "address": address,
                    "rfid_code": rfid_code,
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
                
                # Auto-create any missing MainClass, MainSection, and ClassSection for this school
                for row in valid_data:
                    cname = row.get('class')
                    sname = row.get('section')
                    if cname:
                        if not sname or str(sname).strip() in ['', '-', 'None', 'nan']:
                            sname = 'A'
                        c_obj, _ = MainClass.objects.get_or_create(school=school, name=cname)
                        s_obj, _ = MainSection.objects.get_or_create(school=school, name=sname)
                        ClassSection.objects.get_or_create(school=school, class_ref=c_obj, section_ref=s_obj)

                # Pre-fetch lookup maps
                cs_map = {}
                for cs in ClassSection.objects.filter(school=school).select_related('class_ref', 'section_ref'):
                    key = (cs.class_ref.name, cs.section_ref.name)
                    cs_map[key] = cs

                # Student default password
                default_password_hash = make_password("student@123")

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
                        first_name = BulkImportService._clean_first_name(name, fallback="student")
                        birth_year = BulkImportService._extract_birth_year(row.get('dob'))
                        if birth_year:
                            username = f"{first_name}{birth_year}"
                        else:
                            username = f"{first_name}_{get_random_string(4)}"
                    
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
                            password=default_password_hash,
                            is_first_login=True
                        )
                        users_to_create.append(user)
                        user_created = True
                    
                    class_name = row.get('class')
                    section_name = row.get('section')
                    if class_name and (not section_name or str(section_name).strip() in ['', '-', 'None', 'nan']):
                        section_name = 'A'
                    roll_number = row.get('roll_number')
                    admission_no = row.get('admission_no')
                    rfid_code = row.get('rfid_code')
                    dob_val = row.get('dob')
                    
                    if not admission_no:
                        admission_no = f"ADM-{school.id}-{get_random_string(6).upper()}"
                    
                    father_name = row.get('father_name')
                    mother_name = row.get('mother_name')
                    address_val = row.get('address')
                    father_contact = row.get('father_contact')
                    mother_contact = row.get('mother_contact')
                    
                    cs_key = (class_name, section_name) if class_name else None
                    class_section = cs_map.get(cs_key) if cs_key else None
                    
                    profiles_to_create.append({
                        'user_obj': user,
                        'is_new_user': user_created,
                        'admission_number': admission_no,
                        'roll_number': roll_number,
                        'rfid_code': rfid_code,
                        'dob': dob_val,
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
                    
                    dob_parsed = None
                    if pdata.get('dob'):
                        try:
                            dob_parsed = pd.to_datetime(pdata['dob']).date()
                        except:
                            dob_parsed = None

                    student_profiles_to_create.append(StudentProfile(
                        user=user_obj,
                        school=school,
                        admission_number=pdata['admission_number'],
                        roll_number=pdata['roll_number'],
                        rfid_code=pdata['rfid_code'],
                        dob=dob_parsed,
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
            default_password_hash = make_password("teacher@123")
            
            for row in valid_data:
                try:
                    email = row.get('email')
                    name = row.get('name')
                    phone = row.get('phone')
                    username = row.get('username')

                    # If username is not provided, generate: first_name + employee_id
                    if not username:
                        first_name = BulkImportService._clean_first_name(name, fallback="teacher")
                        emp_id_val = row.get('employee_id')
                        digits = re.findall(r'\d+', str(emp_id_val)) if emp_id_val else []
                        emp_clean = "".join(digits) if digits else (re.sub(r'[^a-zA-Z0-9]', '', str(emp_id_val)).lower() if emp_id_val else get_random_string(4).lower())
                        username = f"{first_name}{emp_clean}"
                        
                    # Ensure username is unique
                    while User.objects.exclude(email=email).filter(username=username).exists():
                        username = f"{username}_{get_random_string(4)}"

                    user, created = User.objects.get_or_create(
                        email=email,
                        defaults={
                            'username': username,
                            'name': name,
                            'phone': phone,
                            'role': import_type,
                            'school': school,
                            'password': default_password_hash,
                            'is_first_login': True
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
                        rfid_code = row.get('rfid_code')
                        
                        if not emp_id:
                            emp_id = f"EMP-{school.id}-{get_random_string(6).upper()}"
                        
                        try:
                            exp_years_int = int(float(experience_years)) if experience_years else None
                        except ValueError:
                            exp_years_int = None
                            
                        # dob and joining_date parsing
                        try:
                            if dob and isinstance(dob, str):
                                dob = pd.to_datetime(dob).date()
                        except:
                            dob = None
                            
                        try:
                            if joining_date and isinstance(joining_date, str):
                                joining_date = pd.to_datetime(joining_date).date()
                        except:
                            joining_date = None
                        
                        teacher_profile, created_profile = TeacherProfile.objects.get_or_create(
                            user=user,
                            defaults={
                                'school': school,
                                'employee_id': emp_id,
                                'subject_specialization': subject_name,
                                'phone_number': phone,
                                'rfid_code': rfid_code,
                                'gender': gender,
                                'dob': dob if dob else None,
                                'qualification': qualification,
                                'experience_years': exp_years_int,
                                'joining_date': joining_date if joining_date else None,
                                'role': None, # Keep role / class teacher NULL by default!
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
