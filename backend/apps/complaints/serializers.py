from rest_framework import serializers

from .models import Complaint, ComplaintComment


class CreateComplaintSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = [
            "title",
            "description",
            "category",
            "is_anonymous",
        ]

    def validate_title(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Title cannot be empty.")
        return value

    def validate_description(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Description cannot be empty.")
        if len(value) > 2000:
            raise serializers.ValidationError("Description cannot exceed 2000 characters.")
        return value


class GetComplaintsSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_batch = serializers.SerializerMethodField()
    comment_count = serializers.IntegerField(read_only=True)
    upvote_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Complaint
        fields = [
            "id",
            "title",
            "description",
            "category",
            "status",
            "is_anonymous",
            "author_name",
            "author_batch",
            "created_at",
            "comment_count",
            "upvote_count",
        ]

    def get_author_name(self, obj):
        if obj.is_anonymous:
            return "Anonymous"

        return obj.user.full_name

    def get_author_batch(self, obj):
        if obj.is_anonymous:
            return None

        return obj.user.batch


class CreateCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintComment
        fields = ["comment", "is_anonymous"]

    def validate_comment(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Comment cannot be empty.")
        if len(value) > 2000:
            raise serializers.ValidationError("Comment cannot exceed 2000 characters.")

        return value

class UpdateComplaintSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = [
            "title",
            "description",
            "category"
        ]

    def validate_title(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                 "Title cannot be empty."
            )
        return value
    
    def validate_description(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                 "Description cannot be empty."
            )
        if len(value) > 2000:
            raise serializers.ValidationError(
                 "Description cannot exceed 2000 characters."
            )
            
        
        return value

class GetCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_batch = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintComment
        fields = [
            "id",
            "comment",
            "is_anonymous",
            "author_name",
            "author_batch",
            "created_at",
        ]

    def get_author_name(self, obj):
        if obj.is_anonymous:
            return "Anonymous"

        return obj.user.full_name

    def get_author_batch(self, obj):
        if obj.is_anonymous:
            return None

        return obj.user.batch
