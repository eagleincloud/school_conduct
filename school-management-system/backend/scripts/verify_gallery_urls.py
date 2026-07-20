import requests

from gallery.models import GalleryImage


for img in GalleryImage.objects.select_related("school").order_by("id"):
    url = img.image.url
    try:
        response = requests.get(url, stream=True, timeout=20)
        content_type = response.headers.get("Content-Type", "")
        print(
            img.id,
            img.school.school_id if img.school else None,
            response.status_code,
            content_type,
            url,
        )
        response.close()
    except Exception as exc:
        print(img.id, img.school.school_id if img.school else None, "ERROR", str(exc), url)
