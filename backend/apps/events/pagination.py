from rest_framework.pagination import CursorPagination

from core.responses import success_response


class EventMessageCursorPagination(CursorPagination):
    """Cursor pagination for the event message history endpoint."""

    page_size = 30
    page_size_query_param = "page_size"
    max_page_size = 50
    ordering = "-created_at"

    def get_paginated_response(self, data):
        """Keep the API response envelope while adding cursor metadata."""
        return success_response(
            message="Messages retrieved successfully.",
            data={
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                "results": data,
            },
        )
