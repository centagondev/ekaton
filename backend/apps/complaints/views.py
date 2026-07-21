from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .serializers import ComplaintSerializer
from .services import (
    create_complaint
)
from core.responses import success_response

class ComplaintAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ComplaintSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        create_complaint(
            user=request.user,
            title=serializer.validated_data["title"],
            description=serializer.validated_data["description"],
            category=serializer.validated_data["category"],
            is_anonymous = serializer.validated_data["is_anonymous"],
        )

        return success_response(
            message="complaint created successfully",
            status_code=201
        )
    

        
