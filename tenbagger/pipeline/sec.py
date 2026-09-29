"""SEC EDGAR client: companyfacts + ticker->CIK map.

- Sends the User-Agent SEC requires (env TENBAGGER_SEC_UA, "Name email@domain").
- Rate limited to <= 10 requests/second (SEC fair-access policy).
- On-disk JSON cache (env TENBAGGER_CACHE_DIR, default tenbagger/pipeline/.cache),
  TTL via TENBAGGER_CACHE_TTL_HOURS (default 24).
- offline=True never touches the network and reads fixtures from
  tenbagger/data/fixtures/edgar/ instead.
"""
from __future__ import annotations

import json
import os
import ssl
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

PKG_DIR = Path(__file__).resolve().parent
TENBAGGER_DIR = PKG_DIR.parent
FIXTURE_EDGAR_DIR = TENBAGGER_DIR / "data" / "fixtures" / "edgar"

COMPANYFACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
DEFAULT_UA = "Tenbagger research pipeline contact@example.com"


class SecError(RuntimeError):
    pass


class RateLimiter:
    """Simple minimum-interval limiter (10 req/s => 0.1 s spacing)."""

    def __init__(self, per_second: float = 10.0):
        self.interval = 1.0 / per_second
        self._lock = threading.Lock()
        self._next = 0.0

    def wait(self) -> None:
        with self._lock:
            now = time.monotonic()
            if now < self._next:
                time.sleep(self._next - now)
                now = time.monotonic()
            self._next = now + self.interval


def cik_file(cik: int) -> str:
    return f"CIK{int(cik):010d}.json"


class SecClient:
    def __init__(self, offline: bool = False, user_agent: str | None = None,
                 cache_dir: str | os.PathLike | None = None, fixture_dir: str | os.PathLike | None = None,
                 ttl_hours: float | None = None, per_second: float = 10.0):
        self.offline = offline
        self.user_agent = user_agent or os.environ.get("TENBAGGER_SEC_UA") or DEFAULT_UA
        self.cache_dir = Path(cache_dir or os.environ.get("TENBAGGER_CACHE_DIR") or PKG_DIR / ".cache")
        self.fixture_dir = Path(fixture_dir or FIXTURE_EDGAR_DIR)
        self.ttl = 3600.0 * float(ttl_hours if ttl_hours is not None
                                  else os.environ.get("TENBAGGER_CACHE_TTL_HOURS", 24))
        self.limiter = RateLimiter(per_second)
        self.requests_made = 0

    # ---------- low level ----------
    def _ssl_context(self):
        cafile = os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE")
        return ssl.create_default_context(cafile=cafile) if cafile else ssl.create_default_context()

    def _get_json(self, url: str, retries: int = 3):
        last = None
        for attempt in range(retries):
            self.limiter.wait()
            req = urllib.request.Request(url, headers={
                "User-Agent": self.user_agent, "Accept-Encoding": "identity",
                "Accept": "application/json"})
            try:
                self.requests_made += 1
                with urllib.request.urlopen(req, timeout=30, context=self._ssl_context()) as r:
                    return json.loads(r.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                last = e
                if e.code in (429, 500, 502, 503, 504):
                    time.sleep(1.5 * (attempt + 1))
                    continue
                raise SecError(f"HTTP {e.code} for {url}"
                               + (" (blocked by proxy? see pipeline/README.md)" if e.code == 403 else "")) from e
            except urllib.error.URLError as e:
                last = e
                time.sleep(1.0 * (attempt + 1))
        raise SecError(f"failed to fetch {url}: {last}")

    def _cached(self, name: str, url: str):
        path = self.cache_dir / name
        if path.exists() and (time.time() - path.stat().st_mtime) < self.ttl:
            with open(path, encoding="utf-8") as fh:
                return json.load(fh)
        data = self._get_json(url)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(data, fh)
        tmp.replace(path)
        return data

    # ---------- public ----------
    def ticker_map(self) -> dict[str, dict]:
        """Return {TICKER: {"cik": int, "name": str}}."""
        if self.offline:
            path = self.fixture_dir / "company_tickers.json"
            if not path.exists():
                return {}
            with open(path, encoding="utf-8") as fh:
                raw = json.load(fh)
        else:
            raw = self._cached("company_tickers.json", TICKERS_URL)
        out = {}
        for row in raw.values():
            out[str(row["ticker"]).upper()] = {"cik": int(row["cik_str"]), "name": row.get("title")}
        return out

    def companyfacts(self, cik: int) -> dict:
        if self.offline:
            path = self.fixture_dir / cik_file(cik)
            if not path.exists():
                raise SecError(f"no offline fixture {path.name} for CIK {cik}")
            with open(path, encoding="utf-8") as fh:
                return json.load(fh)
        return self._cached(f"companyfacts/{cik_file(cik)}", COMPANYFACTS_URL.format(cik=int(cik)))
