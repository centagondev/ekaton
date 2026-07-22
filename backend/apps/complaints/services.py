from django.db import transaction
from django.db.models import Count
from django.http import Http404

from .models import Complaint, ComplaintComment, ComplaintUpvote
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta

def create_complaint(user, title, description, category, is_anonymous):
    complaint = Complaint.objects.create(
        user=user,
        title=title,
        description=description,
        category=category,
        is_anonymous=is_anonymous,
    )

    return complaint


def get_complaints():
    return Complaint.objects.select_related("user").annotate(
        comment_count=Count("comments", distinct=True),
        upvote_count=Count("upvotes", distinct=True),
    )

def can_modify_complaint(user, complaint):
    if complaint.user !=user:
        raise ValidationError(
            "This complaint does not belong to you."
        )
    
    if timezone.now() > complaint.created_at + timedelta(minutes=5):
        raise ValidationError(
            "You can only edit or delete a complaint within 5 minutes of posting"
        )

def update_complaint(user, complaint_id, validated_data):

    complaint = get_object_or_404(Complaint, id=complaint_id)

    can_modify_complaint(user, complaint)

    for fields, value in validated_data.items():
        setattr(complaint,fields, value)

        complaint.save()

        return complaint

def delete_complaint(user, complaint_id):
    complaint = get_object_or_404(Complaint, id=complaint_id)

    can_modify_complaint(user, complaint)

    complaint.delete()

def create_comment(user, complaint_id, comment, is_anonymous):
    if not Complaint.objects.filter(id=complaint_id).exists():
        raise Http404("No Complaint matches the given query.")

    comment_obj = ComplaintComment.objects.create(
        user=user,
        complaint_id=complaint_id,
        comment=comment,
        is_anonymous=is_anonymous,
    )

    return comment_obj


def get_comments(complaint_id):
    if not Complaint.objects.filter(id=complaint_id).exists():
        raise Http404("No Complaint matches the given query.")

    return (
        ComplaintComment.objects.filter(complaint_id=complaint_id)
        .select_related("user")
        .order_by("created_at")
    )


@transaction.atomic
def toggle_upvote(user, complaint_id):
    if not Complaint.objects.filter(id=complaint_id).exists():
        raise Http404("No Complaint matches the given query.")

    upvote, created = ComplaintUpvote.objects.get_or_create(
        user=user,
        complaint_id=complaint_id,
    )

    if not created:
        upvote.delete()
        return False

    return True
