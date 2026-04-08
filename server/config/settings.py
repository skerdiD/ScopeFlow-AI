import os
import sys
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _env_bool(name: str, default: bool = False) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _env_csv(name: str) -> list[str]:
    return [value.strip() for value in os.getenv(name, "").split(",") if value.strip()]


def _normalize_origin(value: str) -> str:
    origin = value.strip().rstrip("/")
    if not origin:
        return ""
    if origin.startswith("http://") or origin.startswith("https://"):
        return origin
    return f"https://{origin}"


def _append_origin(origins: list[str], candidate: str) -> None:
    normalized = _normalize_origin(candidate)
    if normalized and normalized not in origins:
        origins.append(normalized)


IS_TEST = "test" in sys.argv
DEFAULT_DEV_SECRET_KEY = "django-insecure-scopeflow-ai-dev-key"

SECRET_KEY = os.getenv("SECRET_KEY", "").strip() or DEFAULT_DEV_SECRET_KEY
DEBUG = _env_bool("DEBUG", False)

if not DEBUG and not IS_TEST and SECRET_KEY == DEFAULT_DEV_SECRET_KEY:
    raise ImproperlyConfigured("SECRET_KEY must be set to a strong value when DEBUG=False.")

_allowed_hosts = _env_csv("ALLOWED_HOSTS")
_render_external_hostname = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()

if _render_external_hostname and _render_external_hostname not in _allowed_hosts:
    _allowed_hosts.append(_render_external_hostname)

if DEBUG or IS_TEST:
    for _local_host in ("127.0.0.1", "localhost", "testserver"):
        if _local_host not in _allowed_hosts:
            _allowed_hosts.append(_local_host)

if not _allowed_hosts and not (DEBUG or IS_TEST):
    raise ImproperlyConfigured("ALLOWED_HOSTS must be configured when DEBUG=False.")

ALLOWED_HOSTS = _allowed_hosts

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "proposals",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

def _build_postgres_database_config() -> dict:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise ImproperlyConfigured("DATABASE_URL is required and must point to your Supabase PostgreSQL database.")

    parsed = urlparse(database_url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise ImproperlyConfigured("DATABASE_URL must use postgres:// or postgresql:// scheme.")

    db_name = parsed.path.lstrip("/").strip()
    db_host = (parsed.hostname or "").strip()
    db_user = unquote(parsed.username or "").strip()
    db_password = unquote(parsed.password or "").strip()

    if not all([db_name, db_host, db_user, db_password]):
        raise ImproperlyConfigured("DATABASE_URL is missing required PostgreSQL connection parts.")

    conn_max_age = int(os.getenv("DATABASE_CONN_MAX_AGE", "60"))
    query_params = {key: values[-1] for key, values in parse_qs(parsed.query).items() if values}
    database_ssl_mode = os.getenv("DATABASE_SSL_MODE", "").strip()

    if database_ssl_mode:
        query_params["sslmode"] = database_ssl_mode
    elif "sslmode" not in query_params:
        # Supabase Postgres requires SSL in normal environments.
        query_params["sslmode"] = "require"

    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": db_name,
        "USER": db_user,
        "PASSWORD": db_password,
        "HOST": db_host,
        "PORT": str(parsed.port or 5432),
        "CONN_MAX_AGE": conn_max_age,
        "OPTIONS": query_params,
    }


DATABASES = {"default": _build_postgres_database_config()}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

_cors_allowed_origins = _env_csv("CORS_ALLOWED_ORIGINS")
if not _cors_allowed_origins and (DEBUG or IS_TEST):
    _cors_allowed_origins = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ]

_append_origin(_cors_allowed_origins, os.getenv("FRONTEND_URL", ""))
_append_origin(_cors_allowed_origins, os.getenv("VERCEL_URL", ""))
_append_origin(_cors_allowed_origins, "https://scope-flow-ai.vercel.app")

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = _cors_allowed_origins
CORS_ALLOW_CREDENTIALS = _env_bool("CORS_ALLOW_CREDENTIALS", False)
CSRF_TRUSTED_ORIGINS = _env_csv("CSRF_TRUSTED_ORIGINS")

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = _env_bool("SECURE_SSL_REDIRECT", False)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = _env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", True)
    SECURE_HSTS_PRELOAD = _env_bool("SECURE_HSTS_PRELOAD", True)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "proposals.authentication.SupabaseTokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv("DRF_THROTTLE_ANON", "120/min"),
        "user": os.getenv("DRF_THROTTLE_USER", "600/min"),
        "generate_proposal": os.getenv("DRF_THROTTLE_GENERATE_PROPOSAL", "30/hour"),
        "generate_template": os.getenv("DRF_THROTTLE_GENERATE_TEMPLATE", "30/hour"),
    },
}
