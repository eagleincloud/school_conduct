from django.db import models

def school_logo_path(instance, filename):
    return f"School conduct/Schools/{instance.name}/logo/{filename}"

def school_hero_path(instance, filename):
    return f"School conduct/Schools/{instance.name}/hero/{filename}"

class School(models.Model):
    name = models.CharField(max_length=255)
    school_id = models.CharField(max_length=50, unique=True)
    location = models.CharField(max_length=255, null=True, blank=True)
    dealer = models.ForeignKey('dealers.Dealer', on_delete=models.SET_NULL, null=True, blank=True, related_name='schools')
    logo = models.ImageField(upload_to=school_logo_path, null=True, blank=True, max_length=500)
    hero_image = models.ImageField(upload_to=school_hero_path, null=True, blank=True, max_length=500)
    tagline = models.CharField(max_length=255, blank=True)
    about = models.TextField(blank=True)
    established_year = models.IntegerField(null=True, blank=True)
    
    # Contact Info
    contact_email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    google_map_link = models.TextField(blank=True)

    # Academic Info
    board = models.CharField(max_length=100, blank=True) # e.g. CBSE, ICSE, State Board
    classes_offered = models.CharField(max_length=100, blank=True) # e.g. Nursery - 12
    streams = models.CharField(max_length=255, blank=True) # e.g. Science, Commerce, Arts

    # Stats (Manual overrides for landing page)
    total_students_count = models.IntegerField(null=True, blank=True)
    total_teachers_count = models.IntegerField(null=True, blank=True)
    pass_percentage = models.CharField(max_length=10, blank=True)

    # Feature Toggles
    show_facilities = models.BooleanField(default=True)
    show_events = models.BooleanField(default=True)
    show_testimonials = models.BooleanField(default=True)


    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


    def __str__(self):
        return f"{self.name} ({self.school_id})"
