import logging

from rest_framework.views import exception_handler


logger = logging.getLogger(__name__)


def safe_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        view = context.get("view")
        logger.exception("Unhandled API exception in %s", view.__class__.__name__ if view else "unknown view")
        return response

    if response.status_code >= 500:
        logger.warning("API server error handled as %s: %s", response.status_code, exc.__class__.__name__)
        response.data = {"detail": "Server error. Please try again later."}

    return response
