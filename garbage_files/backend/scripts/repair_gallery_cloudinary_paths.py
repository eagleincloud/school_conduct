import os
from collections import defaultdict

import cloudinary
import cloudinary.api

from gallery.models import GalleryImage


cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)


def without_last_suffix(value):
    return value.rsplit("_", 1)[0] if "_" in value else value


def leaf(value):
    return value.rsplit("/", 1)[-1]


resources = []
next_cursor = None
while True:
    response = cloudinary.api.resources(max_results=500, next_cursor=next_cursor)
    resources.extend(response.get("resources", []))
    next_cursor = response.get("next_cursor")
    if not next_cursor:
        break

by_public_id = {resource["public_id"]: resource for resource in resources}
by_base = {}
by_leaf_base = defaultdict(list)

for resource in resources:
    public_id = resource["public_id"]
    candidates = {public_id, without_last_suffix(public_id), without_last_suffix(without_last_suffix(public_id))}
    for candidate in candidates:
        by_base.setdefault(candidate, resource)

    resource_leaf = leaf(public_id)
    leaf_candidates = {
        resource_leaf,
        without_last_suffix(resource_leaf),
        without_last_suffix(without_last_suffix(resource_leaf)),
    }
    for candidate in leaf_candidates:
        by_leaf_base[candidate].append(resource)


updated = 0
for img in GalleryImage.objects.select_related("school").order_by("id"):
    raw_name = img.image.name
    candidates = [
        raw_name,
        without_last_suffix(raw_name),
        without_last_suffix(without_last_suffix(raw_name)),
    ]

    match = None
    for candidate in candidates:
        match = by_base.get(candidate)
        if match:
            break

    if not match:
        raw_leaf = leaf(raw_name)
        leaf_candidates = [
            raw_leaf,
            without_last_suffix(raw_leaf),
            without_last_suffix(without_last_suffix(raw_leaf)),
        ]
        for candidate in leaf_candidates:
            leaf_matches = by_leaf_base.get(candidate) or []
            if leaf_matches:
                school_name = getattr(getattr(img, "school", None), "name", "")
                preferred = [
                    resource
                    for resource in leaf_matches
                    if school_name and school_name in resource["public_id"]
                ]
                match = (preferred or leaf_matches)[0]
                break

    if not match:
        print(f"NO_MATCH id={img.id} name={raw_name}")
        continue

    new_name = match["public_id"]
    if raw_name != new_name:
        print(f"UPDATE id={img.id}: {raw_name} -> {new_name}")
        img.image.name = new_name
        img.save(update_fields=["image"])
        updated += 1
    else:
        print(f"OK id={img.id}: {raw_name}")

print(f"updated={updated}")
