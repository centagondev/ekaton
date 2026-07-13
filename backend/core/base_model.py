import uuid

from django.db import models


class BaseModel(models.Model):
    """Abstract base model that provides UUID primary keys and automatic timestamps.

    All models in this project should inherit from BaseModel to ensure
    consistent primary key handling and audit timestamp fields.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
