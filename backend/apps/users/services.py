from core.cloudinary import upload_image
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