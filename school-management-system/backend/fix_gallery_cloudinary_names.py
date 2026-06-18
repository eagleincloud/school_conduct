import os
import django
import cloudinary
import cloudinary.api

# Initialize Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from gallery.models import GalleryImage

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key=os.getenv('CLOUDINARY_API_KEY'),
    api_secret=os.getenv('CLOUDINARY_API_SECRET')
)

print("Starting gallery image path correction...")

try:
    resources = []
    next_cursor = None
    while True:
        res = cloudinary.api.resources(max_results=500, next_cursor=next_cursor)
        resources.extend(res.get('resources', []))
        next_cursor = res.get('next_cursor')
        if not next_cursor:
            break
            
    print(f"Retrieved {len(resources)} resources from Cloudinary.")
    
    # Create mapping of base public_id (without suffix) to full public_id
    public_id_map = {}
    for r in resources:
        pid = r['public_id']
        # Store full public ID
        public_id_map[pid] = pid
        # Also store base public ID (without the final _xxxxxx suffix)
        if '_' in pid:
            base_pid = pid.rsplit('_', 1)[0]
            public_id_map[base_pid] = pid
            
    print(f"Mapped {len(public_id_map)} base public IDs.")
    
    # Update Django database records
    updated_count = 0
    for img in GalleryImage.objects.all():
        if not img.image:
            continue
            
        raw_name = img.image.name
        base_name, ext = os.path.splitext(raw_name)
        
        # Check if raw_name or base_name matches any public ID in Cloudinary
        if raw_name in public_id_map:
            new_name = public_id_map[raw_name]
            if raw_name != new_name:
                img.image.name = new_name
                img.save()
                print(f"Updated image ID {img.id}: '{raw_name}' -> '{new_name}'")
                updated_count += 1
            else:
                print(f"Image ID {img.id} already matches Cloudinary public ID: '{raw_name}'")
        elif base_name in public_id_map:
            new_name = public_id_map[base_name]
            img.image.name = new_name
            img.save()
            print(f"Updated image ID {img.id}: '{raw_name}' -> '{new_name}'")
            updated_count += 1
        else:
            print(f"No Cloudinary match found for ID {img.id}: '{raw_name}'")
            
    print(f"Finished! Corrected {updated_count} database records.")
except Exception as e:
    print(f"Error occurred: {str(e)}")
