from rest_framework.pagination import CursorPagination


class CommentCursorPagination(CursorPagination):
    page_size = 10
    ordering = ("-created_at", "-id")
    cursor_query_param = "cursor"
