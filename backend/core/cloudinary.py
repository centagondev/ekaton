import logging

import cloudinary.uploader

logger = logging.getLogger(__name__)


def upload_image(file, folder):
    result = cloudinary.uploader.upload(
        file,
        folder=folder,
        resource_type = "image",
    )

    return {
        "url": result["secure_url"],
        "public_id": result["public_id"]
    }


def delete_image(public_id):
    """Remove an uploaded asset, ignoring failures.

    Used to roll back an upload whose owning record was never created. A
    failure here leaves an orphaned asset — never a reason to fail the request
    the caller is already unwinding.
    """
    if not public_id:
        return

    try:
        cloudinary.uploader.destroy(public_id)
    except Exception:
        logger.exception("Failed to delete Cloudinary asset %s", public_id)
