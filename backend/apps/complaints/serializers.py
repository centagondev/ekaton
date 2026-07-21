from rest_framework import serializers
from .models import Complaint

class ComplaintSerializer(serializers.ModelField):
    class Meta:
        model = Complaint
        fields = [
            "title",
            "description",
            "category",
            "is_anonymous",
        ]


    