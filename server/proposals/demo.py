import os


DEMO_EMAIL = os.getenv("DEMO_ACCOUNT_EMAIL", "demo@scopeflow.ai").strip().lower()
DEMO_USERNAME_PREFIX = "demo-seed-"
DEMO_RESTRICTION_MESSAGE = "This action is disabled in demo mode."


def is_demo_user(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False

    email = str(getattr(user, "email", "") or "").strip().lower()
    username = str(user.get_username() or "").strip().lower()
    return email == DEMO_EMAIL or username.startswith(DEMO_USERNAME_PREFIX)
