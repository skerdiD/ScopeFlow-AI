import os
from hashlib import sha256
from typing import Any

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import authentication
from rest_framework import exceptions


class SupabaseTokenAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    @staticmethod
    def _get_auth_cache_ttl_seconds() -> int:
        raw_value = os.getenv("SUPABASE_AUTH_CACHE_TTL", "30").strip()
        try:
            return max(0, int(raw_value))
        except ValueError:
            return 30

    def authenticate(self, request):
        auth_header = authentication.get_authorization_header(request).decode("utf-8").strip()
        if not auth_header:
            return None

        try:
            keyword, token = auth_header.split(" ", 1)
        except ValueError:
            raise exceptions.AuthenticationFailed("Invalid authorization header format.")

        if keyword.lower() != self.keyword.lower():
            return None

        token = token.strip()
        if not token:
            raise exceptions.AuthenticationFailed("Missing bearer token.")

        user_payload = self._fetch_supabase_user(token)
        supabase_user_id = str(user_payload.get("id", "")).strip()
        if not supabase_user_id:
            raise exceptions.AuthenticationFailed("Invalid Supabase user payload.")

        user = self._get_or_create_user(
            supabase_user_id=supabase_user_id,
            email=str(user_payload.get("email", "")).strip(),
        )
        return user, user_payload

    def authenticate_header(self, request):
        return self.keyword

    def _fetch_supabase_user(self, token: str) -> dict[str, Any]:
        cache_ttl_seconds = self._get_auth_cache_ttl_seconds()
        cache_key = f"supabase_auth_user:{sha256(token.encode('utf-8')).hexdigest()}"

        if cache_ttl_seconds > 0:
            cached_payload = cache.get(cache_key)
            if isinstance(cached_payload, dict):
                return cached_payload

        supabase_url = os.getenv("SUPABASE_URL", "").strip()
        supabase_anon_key = os.getenv("SUPABASE_ANON_KEY", "").strip()

        if settings.DEBUG and not supabase_url:
            supabase_url = os.getenv("VITE_SUPABASE_URL", "").strip()

        if settings.DEBUG and not supabase_anon_key:
            supabase_anon_key = (
                os.getenv("VITE_SUPABASE_ANON_KEY", "").strip()
                or os.getenv("VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY", "").strip()
            )

        if not supabase_url or not supabase_anon_key:
            raise exceptions.AuthenticationFailed("Supabase auth environment is not configured.")

        normalized_url = supabase_url.rstrip("/")

        if not normalized_url.lower().startswith("https://") and not settings.DEBUG:
            raise exceptions.AuthenticationFailed("SUPABASE_URL must use HTTPS in production.")

        endpoint = f"{normalized_url}/auth/v1/user"

        try:
            response = requests.get(
                endpoint,
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": supabase_anon_key,
                },
                timeout=10,
                allow_redirects=False,
            )
        except requests.RequestException as exc:
            raise exceptions.AuthenticationFailed("Supabase auth request failed.") from exc

        if response.status_code != 200:
            raise exceptions.AuthenticationFailed("Invalid or expired auth token.")

        try:
            payload = response.json()
        except ValueError as exc:
            raise exceptions.AuthenticationFailed("Supabase auth response was not valid JSON.") from exc

        if not isinstance(payload, dict):
            raise exceptions.AuthenticationFailed("Supabase auth response payload was invalid.")

        if cache_ttl_seconds > 0:
            cache.set(cache_key, payload, timeout=cache_ttl_seconds)

        return payload

    def _get_or_create_user(self, *, supabase_user_id: str, email: str):
        UserModel = get_user_model()
        user, created = UserModel.objects.get_or_create(
            username=supabase_user_id,
            defaults={"email": email},
        )

        changed_fields: list[str] = []
        if email and user.email != email:
            user.email = email
            changed_fields.append("email")

        if created:
            user.set_unusable_password()
            user.save(update_fields=["password", "email"])
        elif changed_fields:
            user.save(update_fields=changed_fields)

        return user
