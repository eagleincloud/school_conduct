import os

import cloudinary
import cloudinary.api

from gallery.models import GalleryImage


cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)


resources = []
next_cursor = None
while True:
    response = cloudinary.api.resources(max_results=500, next_cursor=next_cursor)
    resources.extend(response.get("resources", []))
    next_cursor = response.get("next_cursor")
    if not next_cursor:
        break

print(f"cloudinary_resources={len(resources)}")
for resource in resources:
    public_id = resource.get("public_id", "")
    if "Gallery" in public_id or "SVIS" in public_id or "School conduct" in public_id:
        print("RESOURCE", public_id, resource.get("secure_url"))

print("DB_RECORDS")
for img in GalleryImage.objects.select_related("school").order_by("id"):
    print(img.id, img.school.school_id if img.school else None, img.image.name, img.image.url)
