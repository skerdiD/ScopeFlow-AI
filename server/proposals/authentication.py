import os
from typing import Any

import requests
from django.contrib.auth import get_user_model
from rest_framework import authentication
from rest_framework import exceptions


class SupabaseTokenAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

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
        supabase_url = (
            os.getenv("SUPABASE_URL", "").strip()
            or os.getenv("VITE_SUPABASE_URL", "").strip()
        )
        supabase_anon_key = (
            os.getenv("SUPABASE_ANON_KEY", "").strip()
            or os.getenv("VITE_SUPABASE_ANON_KEY", "").strip()
            or os.getenv("VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY", "").strip()
        )

        if not supabase_url or not supabase_anon_key:
            raise exceptions.AuthenticationFailed("Supabase auth environment is not configured.")

        normalized_url = supabase_url.rstrip("/")
        endpoint = f"{normalized_url}/auth/v1/user"

        try:
            response = requests.get(
                endpoint,
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": supabase_anon_key,
                },
                timeout=10,
            )
        except requests.RequestException as exc:
            raise exceptions.AuthenticationFailed(f"Supabase auth request failed: {str(exc)}") from exc

        if response.status_code != 200:
            raise exceptions.AuthenticationFailed("Invalid or expired auth token.")

        try:
            payload = response.json()
        except ValueError as exc:
            raise exceptions.AuthenticationFailed("Supabase auth response was not valid JSON.") from exc

        if not isinstance(payload, dict):
            raise exceptions.AuthenticationFailed("Supabase auth response payload was invalid.")

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
