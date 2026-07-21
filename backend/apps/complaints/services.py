from .models import Complaint
from rest_framework.exceptions import ValidationError

def create_complaint(user, title, description, category, is_anonymous):
    if not title or title.strip():
        raise ValidationError({
            "title": "title cannot be empty"   
            })
    
    if not description or description.strip():
        raise ValidationError(
            {
                "description": "description cannot be empty"
            }
        )
    
    Complaint.objects.create(
        user=user,
        title=title,
        description=description,
        category=category,
        is_anonymous=is_anonymous
    )

