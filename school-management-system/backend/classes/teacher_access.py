from django.db.models import Q

from .models import ClassSection


def teacher_teaches_class_section(teacher_profile, class_section) -> bool:
    """True if teacher is class teacher for this section or teaches any subject for its class (MainClass)."""
    if not teacher_profile or not class_section:
        return False
    # Direct class teacher on ClassSection
    if class_section.class_teacher_id == teacher_profile.id:
        return True
    
    from subjects.models import TeacherAssignment, Subject

    # Any assignment (Subject Teacher OR Class Teacher) allows general teaching access.
    # Include section-specific and class-wide (section is null) assignments.
    if TeacherAssignment.objects.filter(
        teacher_id=teacher_profile.id,
        class_ref_id=class_section.class_ref_id,
    ).filter(
        Q(section_id=class_section.id) | Q(section__isnull=True)
    ).exists():
        return True

    return Subject.objects.filter(
        class_ref_id=class_section.class_ref_id,
        teachers__id=teacher_profile.id,
        status='Active',
    ).exists()


def teacher_can_mark_attendance(teacher_profile, class_section) -> bool:
    """
    True ONLY if teacher is the Class Teacher for this section.
    Prioritizes explicit 'TeacherAssignment' roles over legacy 'class_teacher' field.
    """
    if not teacher_profile or not class_section:
        return False
        
    from subjects.models import TeacherAssignment
    from django.db.models import Q
    
    # Check for ANY explicit assignments for this teacher in this class/section
    # We include assignments for the specific section AND class-wide (section__isnull=True)
    assignments = TeacherAssignment.objects.filter(
        teacher=teacher_profile,
        class_ref_id=class_section.class_ref_id
    ).filter(
        Q(section_id=class_section.id) | Q(section__isnull=True)
    )

    if assignments.exists():
        # If any explicit assignments exist, the teacher MUST have at least one 'Class Teacher' role 
        # to mark attendance. Subject Teacher assignments for the same class/section will restrict access.
        return assignments.filter(role='Class Teacher').exists()
        
    # 2. Fallback: Check global TeacherProfile.role
    if teacher_profile.role == 'Class Teacher':
        return True
        
    # 3. Fallback: Check direct legacy ClassSection.class_teacher field ONLY if no assignments exist
    return class_section.class_teacher_id == teacher_profile.id


def teacher_accessible_class_sections_queryset(teacher_profile, school):
    """ClassSection rows this teacher may use (attendance, students list, etc.)."""
    from subjects.models import TeacherAssignment, Subject

    # 1. Sections where teacher is the primary Class Teacher (legacy/direct)
    q = Q(class_teacher=teacher_profile)

    # 2. Explicit assignments from TeacherAssignment model
    ta_qs = TeacherAssignment.objects.filter(teacher=teacher_profile)
    
    # - Specific sections assigned to this teacher
    section_ids = set(ta_qs.filter(section__isnull=False).values_list('section_id', flat=True))
    if section_ids:
        q |= Q(id__in=section_ids)
        
    # - Class-wide assignments (applies to all sections of that class)
    combined_class_ids = set(ta_qs.filter(section__isnull=True).values_list('class_ref_id', flat=True))
    
    if combined_class_ids:
        q |= Q(class_ref_id__in=combined_class_ids)

    qs = ClassSection.objects.select_related('class_ref', 'section_ref', 'class_teacher__user').filter(q)
    if school is not None:
        qs = qs.filter(school=school)
    return qs.order_by('class_ref__name', 'section_ref__name').distinct()


def teacher_user_ids_for_student_class_section(class_section) -> set:
    """User IDs of teachers linked to this section's class (class teacher + subject assignments)."""
    if not class_section:
        return set()
    from subjects.models import TeacherAssignment, Subject

    ids = set()
    if class_section.class_teacher_id and class_section.class_teacher:
        ids.add(class_section.class_teacher.user_id)
    for ta in TeacherAssignment.objects.filter(class_ref_id=class_section.class_ref_id).select_related(
        'teacher__user',
    ):
        ids.add(ta.teacher.user_id)
    for subj in Subject.objects.filter(class_ref_id=class_section.class_ref_id, status='Active').prefetch_related(
        'teachers',
    ):
        for t in subj.teachers.all():
            ids.add(t.user_id)
    return ids
