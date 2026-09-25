"""Intrinio stock prices (latest EOD row per security).

Endpoint: GET https://api-v2.intrinio.com/securities/{TICKER}/prices?page_size=1&api_key=KEY
Env: INTRINIO_API_KEY.  Intrinio's Individual/Startup plans are "no redistribution or
display"; a display plan must be recorded in TENBAGGER_INTRINIO_DISPLAY_LICENSE.
One request per ticker, so keep the universe modest or use their bulk products.
"""
from __future__ import annotations

import os
import urllib.parse
from typing import Iterable

from .base import (LicenseInfo, MissingCredentials, PriceQuote, PriceSource, SourceError,
                   license_from_env, norm_tickers)
from .http import http_get

BASE = "https://api-v2.intrinio.com/securities/{ticker}/prices"
TERMS = "https://intrinio.com/pricing"


class IntrinioPriceSource(PriceSource):
    name = "intrinio"

    def __init__(self, api_key: str | None = None, fetch=http_get):
        self.api_key = api_key or os.environ.get("INTRINIO_API_KEY")
        self.fetch = fetch

    @property
    def license(self) -> LicenseInfo:
        return license_from_env("intrinio", "TENBAGGER_INTRINIO_DISPLAY_LICENSE", TERMS,
                                "Intrinio Individual/Startup plans: no redistribution or display.")

    def latest_prices(self, tickers: Iterable[str]) -> dict[str, PriceQuote]:
        if not self.api_key:
            raise MissingCredentials("set INTRINIO_API_KEY")
        out: dict[str, PriceQuote] = {}
        for t in norm_tickers(tickers):
            qs = urllib.parse.urlencode({"page_size": 1, "api_key": self.api_key})
            try:
                data = self.fetch(BASE.format(ticker=urllib.parse.quote(t)) + "?" + qs)
            except SourceError:
                continue  # unknown ticker / transient: omit, caller reports coverage
            rows = (data or {}).get("stock_prices") or []
            if rows and rows[0].get("close"):
                out[t] = PriceQuote(t, float(rows[0]["close"]), str(rows[0].get("date", "")), source=self.name)
        return out
