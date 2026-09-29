"""Upsert companies.json into Supabase via the backend's ``load_companies(doc jsonb)`` RPC.

POST {SUPABASE_URL}/rest/v1/rpc/load_companies  body {"doc": <companies.json>}
Auth: service-role key (server-side only; never ship it to the mobile app).
"""
from __future__ import annotations

import os

from .base import MissingCredentials
from .http import http_post_json


def upsert_companies(doc: dict, url: str | None = None, key: str | None = None, post=http_post_json):
    url = (url or os.environ.get("SUPABASE_URL") or "").rstrip("/")
    key = key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and key):
        raise MissingCredentials("set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    return post(f"{url}/rest/v1/rpc/load_companies", {"doc": doc},
                headers={"apikey": key, "Authorization": f"Bearer {key}"})
