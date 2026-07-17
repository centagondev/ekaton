from rest_framework.permissions import BasePermission


class IsEventOwner(BasePermission):
    """
    Allows access only to the owner of an event.
    """

    message = "You do not have permission to perform this action."

    def has_object_permission(self, request, view, obj):
        """
        Return True only if the authenticated user
        owns the requested event.
        """
        return obj.owner == request.user
