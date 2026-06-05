import os
import django # type: ignore
import re
from typing import List, Optional
from datetime import date
from fastapi import FastAPI, HTTPException, Depends, Query, Request # type: ignore
from fastapi.middleware.cors import CORSMiddleware # type: ignore
from fastapi.staticfiles import StaticFiles # type: ignore
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse # type: ignore
from pydantic import BaseModel, Field, validator # type: ignore
from fastapi.exceptions import RequestValidationError # type: ignore
# 1. Initialize Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

# 2. Import Django models after setup
from accounts.models import User, ActivityLog # type: ignore
from students.models import StudentProfile # type: ignore
from teachers.models import TeacherProfile # type: ignore
from attendance.models import Attendance # type: ignore
from classes.models import ClassSection, MainClass, MainSection # type: ignore
from academics.models import Exam, Result # type: ignore
from fees.models import StudentFee # type: ignore
from assignments.models import Assignment # type: ignore
from timetable.models import TimeTableEntry # type: ignore
from django.db import transaction # type: ignore
from rest_framework_simplejwt.tokens import AccessToken # type: ignore
app = FastAPI(
    title="School Management System - API",
    description="High-performance FastAPI wrapper for Django ORM",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = ", ".join([f"{e['loc'][-1]}: {e['msg']}" for e in errors])
    return JSONResponse(
        status_code=422,
        content={"success": False, "message": f"Validation Error: {msg}", "data": None}
    )

# --- SCHEMAS ---
class LoginSchema(BaseModel):
    username: str
    password: str

class UserSchema(BaseModel):
    id: int
    username: str
    email: str
    role: str

class StudentSchema(BaseModel):
    id: int
    name: str
    username: str
    email: str
    admission_number: str
    class_name: str

class StudentCreateSchema(BaseModel):
    username: str
    email: str
    password: str
    name: str
    admission_number: str
    class_section: str

class TeacherCreateSchema(BaseModel):
    username: str
    email: str
    password: str
    name: str
    employee_id: str
    subject_specialization: Optional[str] = None

class TeacherSchema(BaseModel):
    id: int
    name: str
    employee_id: str
    subject_specialization: Optional[str]

from typing import List, Optional, Literal

class AttendanceSchema(BaseModel):
    student_name: str
    date: date
    status: str

class StudentAttendanceItem(BaseModel):
    student_id: int
    status: Literal["present", "absent", "late"]

class MarkAttendanceSchema(BaseModel):
    class_id: int
    date: date
    records: List[StudentAttendanceItem]

class AssignmentCreateSchema(BaseModel):
    title: str = Field(..., max_length=255, min_length=1)
    description: Optional[str] = None
    class_section: int
    due_date: date
    file_url: Optional[str] = None

    @validator('file_url')
    def validate_url(cls, v):
        if not v or str(v).strip() == "":
            return None
        if not v.startswith(('http://', 'https://')):
            raise ValueError('Invalid URL format, must be http or https')
        return v

class ResultUploadSchema(BaseModel):
    exam: int
    student: int
    subject: str = Field(..., min_length=1)
    marks: float = Field(..., ge=0)
    max_marks: float = Field(..., gt=0)

class StudentAssignClassSchema(BaseModel):
    student_id: int
    class_section_id: int

class SubjectCreateSchema(BaseModel):
    name: str = Field(..., min_length=1)
    class_id: Optional[int] = None
    status: str = "Active"

class SubjectTeacherAssignSchema(BaseModel):
    class_section_id: int
    subject_id: int
    teacher_employee_id: str

class ExamExtendedCreateSchema(BaseModel):
    name: str
    class_section_id: int
    exam_type: str
    start_date: date
    end_date: date
    total_marks: float
    passing_marks: float
    status: str = "Draft"
    description: Optional[str] = None

class FeeStructureCreateSchema(BaseModel):
    class_id: int
    fee_type: str
    amount: float
    due_date: Optional[date] = None
    description: Optional[str] = None

# --- SECURITY & UTILS ---
from fastapi.security import OAuth2PasswordBearer # type: ignore
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login/")

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        access_token = AccessToken(token)
        user = User.objects.get(id=access_token['user_id'])
        return user
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# --- ENDPOINTS ---

@app.get("/", tags=["General"])
def read_root():
    return {"message": "School System is running on FastAPI with Django ORM!"}

@app.get("/api/users/", response_model=List[UserSchema], tags=["Accounts"])
def get_users():
    users = User.objects.all()
    return [UserSchema(**{"id": u.id, "username": u.username, "email": u.email, "role": u.role}) for u in users]

@app.post("/api/auth/login/", tags=["Auth"])
def login(data: LoginSchema):
    from django.contrib.auth import authenticate # type: ignore
    from rest_framework_simplejwt.tokens import RefreshToken # type: ignore
    user = authenticate(username=data.username, password=data.password)
    if user:
        refresh = RefreshToken.for_user(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.id,
                "username": user.username,
                "role": 'superadmin' if getattr(user, 'is_superuser', False) else user.role,
                "name": user.name or user.username,
                "school_id": getattr(user.school, 'school_id', None) if getattr(user, 'school', None) else None,
                "school_name": getattr(user.school, 'name', None) if getattr(user, 'school', None) else None,
                "school_logo": f"/media/{user.school.logo.name}" if getattr(user, 'school', None) and user.school.logo else None
            }
        }
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.get("/api/accounts/profile/", tags=["Accounts"])
def get_profile():
    # Since I don't have a real JWT implementation yet, 
    # and the frontend is just calling this after login,
    # we return a generic admin profile for now as a fallback. 
    # Real logic should identify current user.
    user = User.objects.filter(role='admin').first()
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "name": user.name or user.username
    }

@app.get("/api/students/", response_model=List[StudentSchema], tags=["Students"])
def get_students(class_id: Optional[int] = None):
    query = StudentProfile.objects.select_related('user', 'class_section__class_ref', 'class_section__section_ref')
    if class_id:
        query = query.filter(class_section_id=class_id)
    students = query.all()
    return [
        StudentSchema(**{
            "id": s.id,
            "name": s.user.name or s.user.username,
            "username": s.user.username,
            "email": s.user.email,
            "admission_number": s.admission_number,
            "class_name": f"{s.class_section.class_ref.name} - {s.class_section.section_ref.name}" if s.class_section else "N/A"
        }) for s in students
    ]

@app.post("/api/students/admin/create-student/", tags=["Students"])
def admin_create_student(data: StudentCreateSchema):
    if User.objects.filter(username=data.username).exists():
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User.objects.create_user(
        username=data.username,
        email=data.email,
        password=data.password,
        role='student',
        name=data.name
    )
    
    # Simple parsing logic for class-section (e.g., "10-A", "10A")
    cs_input = data.class_section.upper().replace(' ', '')
    if '-' in cs_input:
        class_name, section_name = cs_input.split('-', 1)
    else:
        match = re.search(r"(\d+)([A-Z]+)", cs_input)
        if match:
            class_name, section_name = match.groups()
        else:
            # Fallback: assume last char is section if length > 1
            if len(cs_input) > 1:
                class_name = str(cs_input)[:-1] # type: ignore
                section_name = str(cs_input)[-1] # type: ignore
            else:
                class_name = cs_input
                section_name = 'A'
    
    c_obj, _ = MainClass.objects.get_or_create(name=class_name)
    s_obj, _ = MainSection.objects.get_or_create(name=section_name)
    cs_obj, _ = ClassSection.objects.get_or_create(class_ref=c_obj, section_ref=s_obj)

    student = StudentProfile.objects.create(
        user=user,
        admission_number=data.admission_number,
        class_section=cs_obj
    )
    
    return {"message": "Student created successfully", "id": student.id}

@app.post("/api/teachers/admin/create-teacher/", tags=["Teachers"])
def admin_create_teacher(data: TeacherCreateSchema):
    if User.objects.filter(username=data.username).exists():
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User.objects.create_user(
        username=data.username,
        email=data.email,
        password=data.password,
        role='teacher',
        name=data.name
    )
    
    teacher = TeacherProfile.objects.create(
        user=user,
        employee_id=data.employee_id,
        subject_specialization=data.subject_specialization
    )
    
    return {"message": "Teacher created successfully", "id": teacher.id}

@app.get("/api/teachers/", response_model=List[TeacherSchema], tags=["Teachers"])
def get_teachers():
    teachers = TeacherProfile.objects.select_related('user').all()
    return [
        TeacherSchema(**{
            "id": t.id,
            "name": t.user.name or t.user.username,
            "employee_id": t.employee_id,
            "subject_specialization": t.subject_specialization
        }) for t in teachers
    ]

@app.get("/api/attendance/", response_model=List[AttendanceSchema], tags=["Attendance"])
def get_attendance(student_id: Optional[int] = Query(None)):
    query = Attendance.objects.select_related('student__user')
    if student_id:
        query = query.filter(student_id=student_id)
    records = query.all()
    return [
        AttendanceSchema(**{
            "student_name": r.student.user.name or r.student.user.username,
            "date": r.date,
            "status": r.status
        }) for r in records
    ]

@app.get("/api/attendance/class/{class_id}/date/{date_str}", tags=["Attendance"])
def get_class_attendance(class_id: int, date_str: str, user = Depends(get_current_user)):
    records = Attendance.objects.filter(student__class_section_id=class_id, date=date_str)
    
    data = []
    for r in records:
        data.append({
            "student_id": r.student_id,
            "status": r.status
        })
    return {"success": True, "message": "Fetched attendance successfully", "data": data}

@app.post("/api/attendance/mark/", tags=["Attendance"])
def mark_attendance(data: MarkAttendanceSchema, user = Depends(get_current_user)):
    if user.role != 'teacher':
        return JSONResponse(status_code=403, content={"success": False, "message": "Not authorized. Only teachers can mark attendance.", "data": None})
    
    try:
        teacher = TeacherProfile.objects.get(user=user)
    except TeacherProfile.DoesNotExist:
        return JSONResponse(status_code=404, content={"success": False, "message": "Teacher profile not found.", "data": None})
        
    # 🔒 VALIDATION: Teacher must belong to class
    try:
        cs = ClassSection.objects.get(id=data.class_id)
        is_assigned = TimeTableEntry.objects.filter(
            teacher=user, 
            class_name=cs.class_ref.name, 
            section=cs.section_ref.name
        ).exists()
    except ClassSection.DoesNotExist:
        is_assigned = False

    if not is_assigned:
        return JSONResponse(status_code=403, content={"success": False, "message": "Permission Denied: You are not assigned to this class.", "data": None})

    # 🔒 VALIDATION: Student List Integrity
    target_students = set(StudentProfile.objects.filter(class_section_id=data.class_id).values_list('id', flat=True))
    submitted_students = set([r.student_id for r in data.records])
    if target_students != submitted_students:
        return JSONResponse(status_code=400, content={"success": False, "message": "Submitted list MUST perfectly match class enrollment. No missing or extra students allowed.", "data": None})

    with transaction.atomic():
        for record in data.records:
            obj, created = Attendance.objects.update_or_create(
                student_id=record.student_id,
                date=data.date,
                defaults={
                    'status': record.status,
                    'class_section_id': data.class_id,
                    'marked_by': teacher,
                    'marked_via': 'manual'
                }
            )
            
        ActivityLog.objects.create(
            user=user,
            action="Marked/Updated Attendance",
            entity=f"Class ID {data.class_id} for date {data.date}"
        )
            
    return {"success": True, "message": f"Successfully marked attendance for {len(data.records)} students.", "data": None}

@app.post("/api/assignments/create/", tags=["Assignments"])
def create_assignment(data: AssignmentCreateSchema, user = Depends(get_current_user)):
    if user.role != 'teacher':
        return JSONResponse(status_code=403, content={"success": False, "message": "Only teachers can create assignments", "data": None})
    
    teacher = TeacherProfile.objects.get(user=user)
    
    try:
        cs = ClassSection.objects.get(id=data.class_section)
        is_assigned = TimeTableEntry.objects.filter(
            teacher=user, 
            class_name=cs.class_ref.name, 
            section=cs.section_ref.name
        ).exists()
    except ClassSection.DoesNotExist:
        is_assigned = False
        
    if not is_assigned:
        return JSONResponse(status_code=403, content={"success": False, "message": "Permission denied: not mapped to this class", "data": None})

    assignment = Assignment.objects.create(
        title=data.title,
        description=data.description,
        class_section_id=data.class_section,
        due_date=data.due_date,
        file_url=data.file_url,
        created_by=teacher
    )
    
    ActivityLog.objects.create(user=user, action="Created Assignment", entity=f"Assignment {assignment.id} for Class {data.class_section}")
    return {"success": True, "message": "Assignment created successfully", "data": {"id": assignment.id}}

@app.get("/api/assignments/class/{class_id}/", tags=["Assignments"])
def get_class_assignments(class_id: int, user = Depends(get_current_user)):
    records = Assignment.objects.filter(class_section_id=class_id).order_by('-due_date')
    data = []
    for r in records:
        data.append({
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "due_date": str(r.due_date),
            "teacher_name": r.created_by.user.name or r.created_by.user.username,
            "file_url": r.file_url
        })
    return {"success": True, "message": "Fetched class assignments", "data": data}

@app.get("/api/assignments/", tags=["Assignments"])
def get_my_assignments(user = Depends(get_current_user)):
    if user.role != 'student':
        return JSONResponse(status_code=403, content={"success": False, "message": "Only students can view isolated assignments", "data": None})
    
    student = StudentProfile.objects.get(user=user)
    records = Assignment.objects.filter(class_section=student.class_section).order_by('-due_date')
    
    data = []
    for r in records:
        data.append({
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "due_date": str(r.due_date),
            "teacher_name": r.created_by.user.name or r.created_by.user.username,
            "file_url": r.file_url
        })
    return {"success": True, "message": "Assignments fetched", "data": data}

@app.get("/api/academics/exams/", tags=["Academics"])
def get_exams(user = Depends(get_current_user)):
    records = Exam.objects.select_related('class_section__class_ref', 'class_section__section_ref').all()
    data = []
    for e in records:
        data.append({
            "id": e.id,
            "name": e.name,
            "class_section": e.class_section.id,
            "class_name": f"{e.class_section.class_ref.name} - {e.class_section.section_ref.name}",
            "date": str(e.date)
        })
    return {"success": True, "message": "Exams loaded", "data": data}

@app.post("/api/academics/results/upload/", tags=["Academics"])
def upload_result(data: ResultUploadSchema, user = Depends(get_current_user)):
    if user.role != 'teacher':
        return JSONResponse(status_code=403, content={"success": False, "message": "Unauthorized", "data": None})
    
    with transaction.atomic():
        obj, created = Result.objects.update_or_create(
            student_id=data.student,
            exam_id=data.exam,
            subject=data.subject,
            defaults={'marks': data.marks, 'max_marks': data.max_marks}
        )
        action_str = "Uploaded Result" if created else "Updated Result"
        ActivityLog.objects.create(user=user, action=action_str, entity=f"Exam ID {data.exam} for Student ID {data.student}")
    return {"success": True, "message": "Result uploaded successfully", "data": None}

@app.get("/api/academics/results/my/", tags=["Academics"])
def get_my_results(user = Depends(get_current_user)):
    if user.role != 'student':
        return JSONResponse(status_code=403, content={"success": False, "message": "Unauthorized", "data": None})
    
    student = StudentProfile.objects.get(user=user)
    records = Result.objects.filter(student=student).select_related('exam')
    
    data = []
    for r in records:
        data.append({
            "id": r.id,
            "exam_name": r.exam.name,
            "subject": r.subject,
            "marks": str(r.marks),
            "max_marks": str(r.max_marks)
        })
    return {"success": True, "message": "Successfully fetched results", "data": data}

@app.get("/api/student/dashboard", tags=["Dashboard"])
def get_student_dashboard(user = Depends(get_current_user)):
    if user.role != 'student':
        return JSONResponse(status_code=403, content={"success": False, "message": "Unauthorized", "data": None})
    
    student = StudentProfile.objects.get(user=user)
    
    total_days = Attendance.objects.filter(student=student).count()
    present_days = Attendance.objects.filter(student=student, status='present').count()
    attendance_percentage = int((present_days/total_days)*100) if total_days > 0 else 100
    
    today = date.today()
    pending_assignments = Assignment.objects.filter(class_section=student.class_section, due_date__gte=today).count()
    
    day_name = today.strftime("%A")
    day_map = {'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7}
    day_num = day_map.get(day_name, 1)
    
    class_name = student.class_section.class_ref.name
    section = student.class_section.section_ref.name
    
    timetable_records = TimeTableEntry.objects.filter(
        class_name=class_name, 
        section=section, 
        day=day_num
    ).order_by('start_time')
    
    timetable_data = []
    for t in timetable_records:
        timetable_data.append({
            "subject": t.subject,
            "teacher_name": t.teacher.name or t.teacher.username,
            "room_info": t.room,
            "start_time": str(t.start_time),
            "end_time": str(t.end_time)
        })
        
    recent_assignments = Assignment.objects.filter(class_section=student.class_section).select_related('created_by__user').order_by('-created_at')[:4]
    lms_data = []
    for a in recent_assignments:
        lms_data.append({
            "code": "TASK",
            "name": a.title,
            "instructor": a.created_by.user.name or a.created_by.user.username,
            "progress": "Pending" if a.due_date >= today else "Completed"
        })
        
    data = {
        "profile": {
            "name": user.name or user.username,
            "class_name": f"{student.class_section.class_ref.name} - {student.class_section.section_ref.name}",
            "admission_number": student.admission_number,
        },
        "stats": {
            "attendance_percentage": attendance_percentage,
            "pending_assignments": pending_assignments,
            "fee_status": "Paid"
        },
        "timetable": timetable_data,
        "lms_subjects": lms_data
    }
    
    return {"success": True, "message": "Dashboard loaded", "data": data}

@app.get("/api/admin/dashboard/stats", tags=["Dashboard"])
def get_admin_dashboard_stats(user = Depends(get_current_user)):
    if user.role != 'admin':
        return JSONResponse(status_code=403, content={"success": False, "message": "Unauthorized", "data": None})
    
    stats = {
        "total_students": StudentProfile.objects.count(),
        "total_teachers": TeacherProfile.objects.count(),
        "active_classes": MainClass.objects.count(),
        "total_sections": MainSection.objects.count()
    }
    
    return {"success": True, "message": "Admin stats generated", "data": stats}

# --- NEW ADMIN MODULE ENDPOINTS ---

@app.get("/api/admin/classes-hierarchy", tags=["Admin Classes"])
def get_classes_hierarchy(user = Depends(get_current_user)):
    if user.role != 'admin':
        return JSONResponse(status_code=403, content={"success": False, "message": "Unauthorized", "data": None})
    
    classes = MainClass.objects.prefetch_related('sections').all()
    data = []
    
    for c in classes:
        # Get sections associated via ClassSection
        sections = ClassSection.objects.filter(class_ref=c).select_related('section_ref', 'class_teacher__user')
        sec_data = []
        for s in sections:
            sec_data.append({
                "id": s.id,
                "name": s.section_ref.name,
                "teacher": s.class_teacher.user.name or s.class_teacher.user.username if s.class_teacher else "None"
            })
            
        data.append({
            "id": c.id,
            "name": c.name,
            "sections": sec_data
        })
        
    return {"success": True, "message": "Hierarchy fetched", "data": data}

@app.post("/api/admin/students/assign", tags=["Admin Classes"])
def admin_assign_student(data: StudentAssignClassSchema, user = Depends(get_current_user)):
    if user.role != 'admin':
        return JSONResponse(status_code=403, content={"success": False, "message": "Unauthorized", "data": None})
        
    try:
        student = StudentProfile.objects.get(id=data.student_id)
        cs = ClassSection.objects.get(id=data.class_section_id)
        student.class_section = cs
        student.save()
        return {"success": True, "message": "Student assigned to class successfully", "data": None}
    except Exception as e:
        return JSONResponse(status_code=400, content={"success": False, "message": str(e), "data": None})

@app.get("/api/admin/subjects", tags=["Admin Subjects"])
def get_admin_subjects(user = Depends(get_current_user)):
    if user.role != 'admin': return JSONResponse(status_code=403, content={"success": False, "message": "Unauthorized", "data": None})
    from academics.models import Subject # type: ignore
    subjects = Subject.objects.select_related('class_ref').all()
    data = []
    for s in subjects:
        data.append({
            "id": s.id,
            "name": s.name,
            "class_name": s.class_ref.name if s.class_ref else "All Classes",
            "status": s.status
        })
    return {"success": True, "data": data}

@app.post("/api/admin/subjects", tags=["Admin Subjects"])
def create_admin_subject(data: SubjectCreateSchema, user=Depends(get_current_user)):
    if user.role != 'admin': return JSONResponse(status_code=403, content={"success": False, "message": "Unauthorized", "data": None})
    from academics.models import Subject # type: ignore
    
    class_ref = None
    if data.class_id:
        class_ref = MainClass.objects.get(id=data.class_id)
        
    s = Subject.objects.create(name=data.name, class_ref=class_ref, status=data.status)
    return {"success": True, "message": "Subject created", "data": {"id": s.id}}

@app.get("/api/admin/subject-teachers", tags=["Admin Teachers"])
def get_subject_teachers(user = Depends(get_current_user)):
    if user.role != 'admin': return JSONResponse(status_code=403, content={"success": False, "message": "Unauthorized", "data": None})
    from academics.models import SubjectTeacherMapping # type: ignore
    mappings = SubjectTeacherMapping.objects.select_related('subject', 'class_section__class_ref', 'class_section__section_ref', 'teacher__user').all()
    
    data = []
    for m in mappings:
        data.append({
            "id": m.id,
            "subject_name": m.subject.name,
            "class_name": f"{m.class_section.class_ref.name} - {m.class_section.section_ref.name}",
            "teacher_name": m.teacher.user.name or m.teacher.user.username,
            "employee_id": m.teacher.employee_id
        })
    return {"success": True, "data": data}

@app.post("/api/admin/subject-teachers/assign", tags=["Admin Teachers"])
def assign_subject_teacher(data: SubjectTeacherAssignSchema, user = Depends(get_current_user)):
    if user.role != 'admin': return JSONResponse(status_code=403, content={"success": False, "message": "Unauthorized", "data": None})
    from academics.models import SubjectTeacherMapping, Subject # type: ignore
    
    try:
        teacher = TeacherProfile.objects.get(employee_id=data.teacher_employee_id)
        subject = Subject.objects.get(id=data.subject_id)
        cs = ClassSection.objects.get(id=data.class_section_id)
        
        obj, created = SubjectTeacherMapping.objects.update_or_create(
            subject=subject,
            class_section=cs,
            defaults={"teacher": teacher}
        )
        return {"success": True, "message": "Teacher assigned to subject successfully", "data": None}
    except Exception as e:
        return JSONResponse(status_code=400, content={"success": False, "message": str(e), "data": None})

@app.post("/api/admin/exams", tags=["Admin Exams"])
def create_admin_exam(data: ExamExtendedCreateSchema, user = Depends(get_current_user)):
    if user.role != 'admin': return JSONResponse(status_code=403, content={"success": False, "message": "Unauthorized", "data": None})
    
    exam = Exam.objects.create(
        name=data.name,
        class_section_id=data.class_section_id,
        exam_type=data.exam_type,
        start_date=data.start_date,
        end_date=data.end_date,
        total_marks=data.total_marks,
        passing_marks=data.passing_marks,
        status=data.status,
        description=data.description
    )
    return {"success": True, "message": "Exam created successfully!", "data": {"id": exam.id}}

@app.get("/api/admin/exams", tags=["Admin Exams"])
def get_extended_exams(user = Depends(get_current_user)):
    if user.role != 'admin': return JSONResponse(status_code=403, content={"success": False, "message": "Unauthorized", "data": None})
    exams = Exam.objects.select_related('class_section__class_ref', 'class_section__section_ref').all().order_by('-start_date')
    
    data = []
    for e in exams:
        data.append({
            "id": e.id,
            "name": e.name,
            "exam_type": e.exam_type,
            "class_name": f"{e.class_section.class_ref.name}-{e.class_section.section_ref.name}",
            "start_date": str(e.start_date) if e.start_date else None,
            "end_date": str(e.end_date) if e.end_date else None,
            "status": e.status
        })
    return {"success": True, "data": data}

@app.get("/api/admin/fees/stats", tags=["Admin Fees"])
def admin_fees_stats(user = Depends(get_current_user)):
    if user.role != 'admin': return JSONResponse(status_code=403, content={"success": False, "message": "Unauthorized", "data": None})
    from fees.models import StudentFee, FeeStructure # type: ignore
    from django.db.models import Sum # type: ignore
    
    # Simple aggregates
    total_structures = FeeStructure.objects.aggregate(Sum('amount'))['amount__sum'] or 0
    # Note: Accurately calculating "Total Fees" requires multiplying structure by enrollment.
    # For speed, we just sum up the StudentFee objects.
    
    fees = StudentFee.objects.all()
    total_fees = sum([f.fee_structure.amount for f in fees])
    total_paid = sum([f.amount_paid for f in fees])
    total_due = total_fees - total_paid
    
    overdue_count = 0
    today = date.today()
    for f in fees:
        if f.due_date and f.due_date < today and f.status != 'paid':
            overdue_count += 1
            
    return {
        "success": True,
        "data": {
            "total_fees": total_fees,
            "total_paid": total_paid,
            "total_due": total_due,
            "overdue_payments": overdue_count
        }
    }

@app.get("/api/admin/fees/structure", tags=["Admin Fees"])
def admin_fees_structure(user = Depends(get_current_user)):
    if user.role != 'admin': return JSONResponse(status_code=403, content={"success": False, "message": "Unauthorized", "data": None})
    from fees.models import FeeStructure # type: ignore
    structs = FeeStructure.objects.select_related('class_ref').all()
    
    data = []
    for s in structs:
        data.append({
            "id": s.id,
            "class_name": s.class_ref.name,
            "fee_type": s.fee_type,
            "amount": float(s.amount),
            "due_date": str(s.due_date) if s.due_date else None,
            "description": s.description
        })
    return {"success": True, "data": data}

@app.post("/api/admin/fees/structure", tags=["Admin Fees"])
def create_fee_structure(data: FeeStructureCreateSchema, user = Depends(get_current_user)):
    if user.role != 'admin': return JSONResponse(status_code=403, content={"success": False, "message": "Unauthorized", "data": None})
    from fees.models import FeeStructure # type: ignore
    
    fs = FeeStructure.objects.create(
        class_ref_id=data.class_id,
        fee_type=data.fee_type,
        amount=data.amount,
        due_date=data.due_date,
        description=data.description
    )
    return {"success": True, "message": "Fee structure added successfully", "data": {"id": fs.id}}

# --- MASTER DASHBOARDS ---
@app.get("/api/teacher/dashboard", tags=["Teacher Dashboard"])
def teacher_dashboard(user = Depends(get_current_user)):
    if user.role != 'teacher':
        raise HTTPException(status_code=403, detail="Not authorized. Role must be teacher.")
    
    try:
        teacher = TeacherProfile.objects.get(user=user)
    except TeacherProfile.DoesNotExist:
        raise HTTPException(status_code=404, detail="Teacher profile not found")

    today = date.today()
    day_name = today.strftime('%A')
    day_map = {'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6}
    day_num = day_map.get(day_name, 1)
    
    # 1. Classes Today
    timetables = TimeTableEntry.objects.filter(teacher=teacher, day=day_num)
    
    classes_today = []
    attendance_pending = 0
    
    for t in timetables:
        c_name = f"{t.class_name}-{t.section}"
        classes_today.append({
            "time": t.start_time.strftime("%I:%M %p"),
            "name": c_name,
            "subject": t.subject,
            "room": t.room
        })
        # Check if attendance marked using the newly indexed class_section field (optimized)
        is_marked = Attendance.objects.filter(class_section=t.class_section, date=today).exists()
        if not is_marked:
            attendance_pending += 1

    # 2. Assignments
    assignments_pending = Assignment.objects.filter(created_by=teacher, due_date__gte=today).count()
    
    # Returning structured data
    return {
        "success": True,
        "message": "Dashboard data retrieved",
        "data": {
            "classes_today": classes_today,
            "attendance_pending": attendance_pending,
            "assignments_pending": assignments_pending,
            "results_pending": 0, # Placeholder until results logic
            "notifications": [
                {"title": "Welcome to your new dashboard", "time": "Just now", "type": "System"}
            ],
            "recent_activity": [],
            "quick_actions": {
                "can_mark_attendance": True,
                "can_upload_result": True
            }
        }
    }

@app.get("/api/timetable/teacher/today", tags=["Timetable"])
def teacher_timetable_today(user = Depends(get_current_user)):
    if user.role != 'teacher':
        raise HTTPException(status_code=403, detail="Not authorized")
    from teachers.models import TeacherProfile # type: ignore
    from timetable.models import TimeTableEntry # type: ignore
    from datetime import date
    
    teacher = TeacherProfile.objects.get(user=user)
    day_name = date.today().strftime('%A')
    timetables = TimeTableEntry.objects.filter(teacher=teacher, day=day_name).select_related('class_section__class_ref', 'class_section__section_ref')
    
    data = []
    for t in timetables:
        data.append({
            "id": t.id,
            "class_name": f"{t.class_section.class_ref.name}-{t.class_section.section_ref.name}",
            "subject": t.subject,
            "start_time": t.start_time.strftime("%I:%M %p"),
            "end_time": t.end_time.strftime("%I:%M %p")
        })
    return {"success": True, "data": data}
# --- Static File Serving (Frontend) ---

# This will serve the React frontend from the 'dist' folder
media_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "media")
if os.path.exists(media_dir):
    app.mount("/media", StaticFiles(directory=media_dir), name="media")

# Serve React assets
if os.path.exists("dist"):
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

@app.get("/{full_path:path}", tags=["General"])
async def serve_frontend(full_path: str):
    # Exclude API and Docs from being caught by frontend router
    if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
        raise HTTPException(status_code=404)
        
    # Serve index.html for all other routes (SPA)
    if os.path.exists("dist/index.html"):
        return FileResponse("dist/index.html")
    
    return HTMLResponse("""
        <div style='text-align:center; padding-top:100px; font-family:sans-serif;'>
            <h1>School System API is Active! 🚀</h1>
            <p>Frontend build (<code>dist</code>) not found.</p>
            <p>To see the UI, please run <code>npm run build</code> first.</p>
            <p>Or use <a href='/docs'>Swagger API Docs</a>.</p>
        </div>
    """)

import uvicorn # type: ignore
import subprocess
import threading

def start_frontend():
    print("Starting Frontend (Vite) on http://localhost:5173 ...")
    try:
        # Use npx to ensure we find the local vite
        subprocess.Popen(["npx", "vite", "--port", "5173", "--host", "127.0.0.1"], shell=True)
    except Exception as e:
        print(f"❌ Error starting frontend: {e}")

if __name__ == "__main__":
    # 1. Start Frontend in background
    frontend_thread = threading.Thread(target=start_frontend, daemon=True)
    frontend_thread.start()
    
    # 2. Start Backend
    print("Starting Backend (FastAPI) on http://127.0.0.1:8000 ...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
