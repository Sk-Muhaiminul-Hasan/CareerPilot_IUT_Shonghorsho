"""JWT authentication helpers for Supabase-issued access tokens."""

from __future__ import annotations

import time
from typing import Any

import requests
from fastapi import Depends, HTTPException, Request
from jose import jwt, JWTError

from app.config.settings import get_settings

settings = get_settings()

_AUTH_EXCEPTION = HTTPException(
    status_code=401,
    detail="Invalid or missing authentication token",
    headers={"WWW-Authenticate": "Bearer"},
)

JWKS_URL = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
_jwks_cache: dict[str, Any] | None = None
_jwks_cache_expires_at: float = 0.0


def _get_jwks() -> dict[str, Any]:
    global _jwks_cache, _jwks_cache_expires_at
    now = time.time()
    if _jwks_cache is None or now >= _jwks_cache_expires_at:
        response = requests.get(JWKS_URL, timeout=10)
        response.raise_for_status()
        payload = response.json()
        _jwks_cache = payload
        cache_control = response.headers.get("Cache-Control", "")
        max_age = 3600
        if "max-age=" in cache_control:
            try:
                max_age = int(cache_control.split("max-age=")[1].split(",")[0].strip())
            except (ValueError, IndexError):
                pass
        _jwks_cache_expires_at = now + max_age
    return _jwks_cache


def _decode_token(token: str) -> dict[str, Any]:
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        jwks = _get_jwks()
        key_data = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)

        if not key_data:
            raise _AUTH_EXCEPTION

        payload = jwt.decode(
            token,
            key_data,
            algorithms=[key_data.get("alg", "ES256")],
            options={"verify_aud": False, "verify_iss": False},
        )
    except (JWTError, Exception) as exc:
        raise _AUTH_EXCEPTION from exc

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise _AUTH_EXCEPTION

    exp = payload.get("exp")
    if not isinstance(exp, (int, float)):
        raise _AUTH_EXCEPTION

    return payload


async def get_current_user(
    request: Request,
    db: Any = Depends(lambda: None),
) -> str:
    del db
    authorization = request.headers.get("authorization")
    if not authorization:
        raise _AUTH_EXCEPTION
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise _AUTH_EXCEPTION
    payload = _decode_token(parts[1])
    return payload["sub"]


async def get_current_user_ws(
    authorization: str | None,
) -> str:
    if not authorization:
        raise _AUTH_EXCEPTION
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise _AUTH_EXCEPTION
    payload = _decode_token(parts[1])
    return payload["sub"]
