from rest_framework import status
from rest_framework.response import Response


def success_response(data=None, message="success", status_code=status.HTTP_200_OK):
    """Return a standardized JSON success response.

    Args:
        data: The response payload. Defaults to None.
        message: A human-readable success message. Defaults to "success".
        status_code: The HTTP status code. Defaults to 200 OK.
    """
    return Response(
        {"success": True, "message": message, "data": data}, status=status_code
    )


def error_response(
    data=None,
    message="Something went wrong.",
    status_code=status.HTTP_400_BAD_REQUEST,
):
    """Return a standardized JSON error response.

    Args:
        data: Optional error detail payload. Defaults to None.
        message: A human-readable error message. Defaults to "Something went wrong."
        status_code: The HTTP status code. Defaults to 400 Bad Request.
    """
    return Response(
        {"success": False, "message": message, "data": None}, status=status_code
    )
