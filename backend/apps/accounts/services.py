
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate

def login_user(request, email, password):
    # Check whether the user exists and the password is correct


    user = authenticate(
        request=request,
        email=email,
        password=password
    )

    if user is None:
        raise AuthenticationFailed("Invalid email or password")

    if not user.is_active:
        return AuthenticationFailed("Account is inactive")

    
    refresh = RefreshToken.for_user(user)

    return {
        "user":user,
        "access":str(refresh.access_token),
        "refresh": str(refresh)
    }
    

