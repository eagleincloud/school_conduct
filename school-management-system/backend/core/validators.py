from pathlib import Path

from django.conf import settings


def validate_uploaded_file(uploaded_file, *, allowed_extensions=None):
    """Apply consistent size and extension limits before sending a file to storage."""
    if uploaded_file.size > settings.API_MAX_UPLOAD_BYTES:
        max_mb = settings.API_MAX_UPLOAD_BYTES // (1024 * 1024)
        raise ValueError(f'File exceeds the {max_mb} MB upload limit.')

    if allowed_extensions:
        extension = Path(uploaded_file.name).suffix.lower()
        if extension not in allowed_extensions:
            allowed = ', '.join(sorted(allowed_extensions))
            raise ValueError(f'Unsupported file type. Allowed types: {allowed}.')

    return uploaded_file
