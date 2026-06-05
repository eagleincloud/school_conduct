from tenants.models import School
from classes.models import MainClass, MainSection, ClassSection
from subjects.models import Subject
from holidays.models import Holiday
from timetable.models import TimeTableEntry

try:
    default_school = School.objects.get(school_id='DEFAULT')
    
    mc = MainClass.objects.filter(school__isnull=True).update(school=default_school)
    ms = MainSection.objects.filter(school__isnull=True).update(school=default_school)
    cs = ClassSection.objects.filter(school__isnull=True).update(school=default_school)
    sub = Subject.objects.filter(school__isnull=True).update(school=default_school)
    hol = Holiday.objects.filter(school__isnull=True).update(school=default_school)
    tt = TimeTableEntry.objects.filter(school__isnull=True).update(school=default_school)
    
    print(f"Migrated classes: {mc}, sections: {ms}, class_sections: {cs}")
    print(f"Migrated subjects: {sub}, holidays: {hol}, timetables: {tt}")
except Exception as e:
    print(f"Error migrating: {e}")
