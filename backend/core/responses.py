from rest_framework.response import Response
from rest_framework import status


def success_response(data=None, message="success", status_code=status.HTTP_200_OK):
    return Response(
        {"success": True, "message": message, "data": data}, status=status_code
    )


def error_response(
    data=None,
    message="somethink went to wrong",
    status_code=status.HTTP_400_BAD_REQUEST,
):
    return Response(
        {"success": False, "message": message, "data": None}, status=status_code
    )