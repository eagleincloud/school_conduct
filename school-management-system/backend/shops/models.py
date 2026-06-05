from django.db import models

class Shop(models.Model):
    SHOP_TYPES = [
        ('Book Shop', 'Book Shop'),
        ('Uniform Shop', 'Uniform Shop'),
        ('Stationery', 'Stationery'),
        ('Other', 'Other'),
    ]
    
    shop_name = models.CharField(max_length=255)
    shop_type = models.CharField(max_length=50, choices=SHOP_TYPES)
    address = models.TextField()
    city = models.CharField(max_length=100)
    contact_number = models.CharField(max_length=20)
    google_map_link = models.URLField(max_length=500, blank=True, null=True)
    school = models.ForeignKey('tenants.School', on_delete=models.CASCADE, null=True, blank=True, related_name='shops')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.shop_name} ({self.shop_type})"
