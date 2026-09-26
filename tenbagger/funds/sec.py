"""Minimal live SEC client for fund data (stdlib only).

Live flow for one ETF ticker:
1. ``company_tickers_mf.json`` → (trust CIK, series id, class id) for the ticker
2. ``submissions/CIK##########.json`` → recent ``NPORT-P`` accessions (a trust files one
   per series, so we open them newest-first until ``genInfo/seriesId`` matches)
3. ``Archives/edgar/data/<cik>/<acc>/primary_doc.xml`` → N-PORT XML
4. newest ``485BPOS`` / ``497K`` primary document → risk/return iXBRL → expense ratio

Honours TENBAGGER_SEC_UA (SEC requires "Name email"), SSL_CERT_FILE / REQUESTS_CA_BUNDLE and
HTTPS_PROXY; ≤ 10 requests/second; on-disk cache in ``funds/.cache`` (TENBAGGER_CACHE_DIR).
``data.sec.gov`` / ``www.sec.gov`` are blocked in the Claude sandbox; tests never call this.
"""
from __future__ import annotations

import json
import os
import ssl
import time
import urllib.error
import urllib.request
from pathlib import Path

from .nport import NportFiling, parse_nport

MF_TICKERS_URL = "https://www.sec.gov/files/company_tickers_mf.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik:010d}.json"
ARCHIVE_URL = "https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/{doc}"
DEFAULT_UA = "Tenbagger research funds contact@example.com"


class SecError(RuntimeError):
    pass


class FundSecClient:
    def __init__(self, user_agent: str | None = None, cache_dir: str | os.PathLike | None = None,
                 ttl_hours: float = 24.0, max_nport_scan: int = 60):
        self.ua = user_agent or os.environ.get("TENBAGGER_SEC_UA") or DEFAULT_UA
        base = cache_dir or os.environ.get("TENBAGGER_CACHE_DIR")
        self.cache = Path(base) / "funds" if base else Path(__file__).resolve().parent / ".cache"
        self.ttl = ttl_hours * 3600
        self.max_nport_scan = max_nport_scan
        self._last = 0.0

    def _ctx(self):
        ca = os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE")
        return ssl.create_default_context(cafile=ca) if ca else ssl.create_default_context()

    def get(self, url: str, cache_name: str | None = None) -> bytes:
        if cache_name:
            p = self.cache / cache_name
            if p.exists() and time.time() - p.stat().st_mtime < self.ttl:
                return p.read_bytes()
        last: Exception | None = None
        for attempt in range(3):
            wait = self._last + 0.11 - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()
            req = urllib.request.Request(url, headers={"User-Agent": self.ua, "Accept-Encoding": "identity"})
            try:
                with urllib.request.urlopen(req, timeout=30, context=self._ctx()) as r:
                    body = r.read()
                if cache_name:
                    p = self.cache / cache_name
                    p.parent.mkdir(parents=True, exist_ok=True)
                    p.write_bytes(body)
                return body
            except urllib.error.HTTPError as e:
                last = e
                if e.code in (429, 500, 502, 503, 504):
                    time.sleep(1.5 * (attempt + 1))
                    continue
                raise SecError(f"HTTP {e.code} for {url}" + (" (proxy block?)" if e.code == 403 else "")) from e
            except urllib.error.URLError as e:
                last = e
                time.sleep(attempt + 1)
        raise SecError(f"failed to fetch {url}: {last}")

    def get_json(self, url: str, cache_name: str | None = None):
        return json.loads(self.get(url, cache_name).decode("utf-8"))

    # ------------------------------------------------------------------ lookups
    def fund_ids(self, ticker: str) -> dict | None:
        """{'cik': int, 'series_id': str, 'class_id': str} for an ETF/mutual-fund ticker."""
        raw = self.get_json(MF_TICKERS_URL, "company_tickers_mf.json")
        fields = raw.get("fields", [])
        for row in raw.get("data", []):
            rec = dict(zip(fields, row))
            if str(rec.get("symbol", "")).upper() == ticker.upper():
                return {"cik": int(rec["cik"]), "series_id": rec.get("seriesId"), "class_id": rec.get("classId")}
        return None

    def recent_filings(self, cik: int, forms: tuple[str, ...]) -> list[dict]:
        sub = self.get_json(SUBMISSIONS_URL.format(cik=cik), f"submissions/CIK{cik:010d}.json")
        r = sub.get("filings", {}).get("recent", {})
        out = []
        for i, form in enumerate(r.get("form", [])):
            if form in forms:
                out.append({"form": form, "accession": r["accessionNumber"][i],
                            "filed": r["filingDate"][i], "doc": r["primaryDocument"][i]})
        return out  # newest first, as EDGAR returns them

    def latest_nport(self, cik: int, series_id: str | None) -> tuple[NportFiling, str] | None:
        for f in self.recent_filings(cik, ("NPORT-P", "NPORT-P/A"))[: self.max_nport_scan]:
            acc = f["accession"].replace("-", "")
            url = ARCHIVE_URL.format(cik=cik, acc=acc, doc="primary_doc.xml")
            filing = parse_nport(self.get(url, f"nport/{acc}.xml"))
            if not series_id or filing.series_id == series_id:
                return filing, url
        return None

    def latest_prospectus(self, cik: int) -> tuple[str, str] | None:
        for f in self.recent_filings(cik, ("485BPOS", "497K"))[:5]:
            acc = f["accession"].replace("-", "")
            url = ARCHIVE_URL.format(cik=cik, acc=acc, doc=f["doc"])
            try:
                return self.get(url, f"rr/{acc}.htm").decode("utf-8", "replace"), url
            except SecError:
                continue
        return None
