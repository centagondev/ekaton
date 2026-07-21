from django.db import transaction
from django.db.models import Count
from django.http import Http404

from .models import Complaint, ComplaintComment, ComplaintUpvote


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
