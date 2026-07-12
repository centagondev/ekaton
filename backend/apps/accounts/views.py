from rest_framework import status
from rest_framework.views import APIView

from core.responses import success_response,error_response
from rest_framework.exceptions import AuthenticationFailed

from .serializers import(
    LoginSerializer
)

from apps.users.serializers import UserSerializer

from .services import (
    login_user
)

class LoginAPIView(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)

        if not serializer.is_valid():
            return error_response(
                message=serializer.errors,      
            )  
        try:
            result = login_user(
                request=request,
                email=serializer.validated_data["email"],
                password=serializer.validated_data["password"]
            )
        except AuthenticationFailed as e:
            return error_response(
                message= str(e.detail) if hasattr(e, "detail") else str(e),
                status_code=401
            )
        
        user = result["user"]
        
        return success_response(
            message="Login successful",
            data={
                "access":result["access"],
                "refresh": result["refresh"],
                "user": UserSerializer(user).data
            }
        )