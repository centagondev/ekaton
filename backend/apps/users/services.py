from core.cloudinary import delete_image, upload_image
import cloudinary.uploader

def update_profile_photo(user, profile_photo):

    if user.profile_photo_public_id:
        cloudinary.uploader.destroy(user.profile_photo_public_id)

    upload = upload_image(
        profile_photo,
        "profile"
    )

    user.profile_photo = upload["url"]
    user.profile_photo_public_id = upload["public_id"]

    user.save(
        update_fields = [
            "profile_photo",
            "profile_photo_public_id"
        ]
    )

    return user


def remove_profile_photo(user):
    """Drop the user's photo and the Cloudinary asset behind it.

    Idempotent: a user who already has no photo is left untouched, so a
    double-tap on the confirm button cannot fail the second time.

    `delete_image` is used rather than `cloudinary.uploader.destroy` on
    purpose — it swallows and logs a failure. The record is the source of
    truth for what the app shows, so a Cloudinary outage must not be able to
    trap someone with a photo they have asked to remove; the worst case is an
    orphaned asset, which is logged.
    """
    if not user.profile_photo and not user.profile_photo_public_id:
        return user

    delete_image(user.profile_photo_public_id)

    user.profile_photo = None
    user.profile_photo_public_id = None

    user.save(
        update_fields = [
            "profile_photo",
            "profile_photo_public_id"
        ]
    )

    return user