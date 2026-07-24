from django.db import transaction
from django.db.models import Count
from django.http import Http404

from .models import Complaint, ComplaintComment, ComplaintUpvote
from rest_framework.exceptions import ValidationError,PermissionDenied
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta

@transaction.atomic
def create_complaint(user, title, description, category, is_anonymous):
    complaint = Complaint.objects.create(
        user=user,
        title=title,
        description=description,
        category=category,
        is_anonymous=is_anonymous,
    )

    return complaint


from django.db.models import Count, Subquery, OuterRef
from django.db.models.functions import Coalesce

def get_complaints():
    comments_subquery = ComplaintComment.objects.filter(
        complaint=OuterRef("pk")
    ).values("complaint").annotate(c=Count("id")).values("c")

    upvotes_subquery = ComplaintUpvote.objects.filter(
        complaint=OuterRef("pk")
    ).values("complaint").annotate(c=Count("id")).values("c")

    return Complaint.objects.select_related("user").annotate(
        comment_count=Coalesce(Subquery(comments_subquery), 0),
        upvote_count=Coalesce(Subquery(upvotes_subquery), 0),
    )

def get_complaint(complaint_id):
    try:
        return get_complaints().get(id=complaint_id)
    except Complaint.DoesNotExist:
        raise Http404("No Complaint matches the given query.")

def can_modify_complaint(user, complaint):
    if complaint.user !=user:
        raise PermissionDenied(
            "This complaint does not belong to you."
        )
    
    if timezone.now() > complaint.created_at + timedelta(minutes=5):
        raise PermissionDenied(
            "You can only edit or delete a complaint within 5 minutes of posting."
        )
    
@transaction.atomic
def update_complaint(user, complaint_id, validated_data):

    try:
        complaint = Complaint.objects.select_for_update().get(id=complaint_id)
    except Complaint.DoesNotExist:
        raise Http404("No Complaint matches the given query.")

    can_modify_complaint(user, complaint)

    for fields, value in validated_data.items():
        setattr(complaint,fields, value)

    update_fields = list(validated_data.keys())
    update_fields.append("updated_at")
    
    complaint.save(update_fields=update_fields)

    return complaint

@transaction.atomic
def delete_complaint(user, complaint_id):
    try:
        complaint = Complaint.objects.select_for_update().get(id=complaint_id)
    except Complaint.DoesNotExist:
        raise Http404("No Complaint matches the given query.")

    can_modify_complaint(user, complaint)

    complaint.delete()

@transaction.atomic
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
