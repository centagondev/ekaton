from rest_framework.permissions import BasePermission
from django.db import models
from apps.chat.models import PrivateChatRoom

class IsChatParticipant(BasePermission):
     """Allow access only to users participating in the chat room."""

     def has_permission(self, request, view):
          room_id = view.kwargs.get("room_id")

          if room_id is None:
               return False
          
          return PrivateChatRoom.objects.filter(
               id=room_id,
               status = PrivateChatRoom.Status.ACTIVE
          ).filter(
               models.Q(user_one=request.user) | models.Q(user_two=request.user)
          ).exists()