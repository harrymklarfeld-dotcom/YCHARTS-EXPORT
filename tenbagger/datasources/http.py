"""Tiny stdlib HTTP helper. Adapters take an injectable ``fetch`` so tests never hit the network."""
from __future__ import annotations

import json
import os
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Callable

from .base import SourceError

Fetch = Callable[..., object]


def _ctx():
    cafile = os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE")
    return ssl.create_default_context(cafile=cafile) if cafile else ssl.create_default_context()


def redact(url: str) -> str:
    """Strip secrets from query strings before they reach logs/exceptions."""
    p = urllib.parse.urlsplit(url)
    q = [(k, "***" if k.lower() in {"api_token", "apikey", "api_key", "token"} else v)
         for k, v in urllib.parse.parse_qsl(p.query, keep_blank_values=True)]
    return urllib.parse.urlunsplit(p._replace(query=urllib.parse.urlencode(q)))


def http_get(url: str, headers: dict | None = None, retries: int = 3, timeout: float = 30,
             as_json: bool = True):
    last = None
    for attempt in range(retries):
        req = urllib.request.Request(url, headers={"Accept-Encoding": "identity", **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=_ctx()) as r:
                body = r.read()
            return json.loads(body.decode("utf-8")) if as_json else body
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2.0 * (attempt + 1))
                continue
            raise SourceError(f"HTTP {e.code} for {redact(url)}") from e
        except urllib.error.URLError as e:
            last = e
            time.sleep(1.0 * (attempt + 1))
    raise SourceError(f"failed to fetch {redact(url)}: {last}")


def http_post_json(url: str, payload, headers: dict | None = None, timeout: float = 120):
    data = json.dumps(payload, allow_nan=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST",
                                 headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_ctx()) as r:
            body = r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        raise SourceError(f"HTTP {e.code} for POST {redact(url)}: "
                          f"{e.read()[:300].decode('utf-8', 'replace')}") from e
    return json.loads(body) if body.strip() else None
