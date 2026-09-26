"""Financial Modeling Prep quotes (batch).

Endpoint: GET https://financialmodelingprep.com/stable/batch-quote?symbols=A,B&apikey=KEY
Env: FMP_API_KEY.  FMP's published terms require a separate Data Display and Licensing
Agreement before data is shown in an app; record it in TENBAGGER_FMP_DISPLAY_LICENSE.
"""
from __future__ import annotations

import os
import urllib.parse
from datetime import datetime, timezone
from typing import Iterable

from .base import (LicenseInfo, MissingCredentials, PriceQuote, PriceSource, SourceError, chunks,
                   license_from_env, norm_tickers)
from .http import http_get

BASE = "https://financialmodelingprep.com/stable/batch-quote"
TERMS = "https://site.financialmodelingprep.com/faqs"


class FmpPriceSource(PriceSource):
    name = "fmp"

    def __init__(self, api_key: str | None = None, fetch=http_get):
        self.api_key = api_key or os.environ.get("FMP_API_KEY")
        self.fetch = fetch

    @property
    def license(self) -> LicenseInfo:
        return license_from_env("fmp", "TENBAGGER_FMP_DISPLAY_LICENSE", TERMS,
                                "FMP subscription plans do not include display rights.")

    def latest_prices(self, tickers: Iterable[str]) -> dict[str, PriceQuote]:
        if not self.api_key:
            raise MissingCredentials("set FMP_API_KEY")
        wanted = norm_tickers(tickers)
        out: dict[str, PriceQuote] = {}
        for batch in chunks(wanted, 100):
            qs = urllib.parse.urlencode({"symbols": ",".join(batch), "apikey": self.api_key})
            data = self.fetch(f"{BASE}?{qs}")
            if not isinstance(data, list):
                raise SourceError(f"fmp: unexpected payload {str(data)[:200]}")
            for row in data:
                t = str(row.get("symbol", "")).upper()
                if t in batch and row.get("price") and row.get("timestamp"):
                    d = datetime.fromtimestamp(int(row["timestamp"]), tz=timezone.utc).strftime("%Y-%m-%d")
                    out[t] = PriceQuote(t, float(row["price"]), d, source=self.name)
        return out
