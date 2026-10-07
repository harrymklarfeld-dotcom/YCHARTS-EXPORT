"""EODHD end-of-day prices (bulk last day for the US exchange).

Endpoint: GET https://eodhd.com/api/eod-bulk-last-day/US?api_token=KEY&fmt=json&symbols=AAPL,MSFT
Env: EODHD_API_TOKEN.  Display requires an EODHD commercial (B2B) licence recorded in
TENBAGGER_EODHD_DISPLAY_LICENSE; personal plans are non-commercial.
"""
from __future__ import annotations

import os
import urllib.parse
from typing import Iterable

from .base import (LicenseInfo, MissingCredentials, PriceQuote, PriceSource, SourceError, chunks,
                   license_from_env, norm_tickers)
from .http import http_get

BASE = "https://eodhd.com/api/eod-bulk-last-day/US"
TERMS = "https://eodhd.com/financial-apis/commercial-vs-personal-license-use"


class EodhdPriceSource(PriceSource):
    name = "eodhd"

    def __init__(self, token: str | None = None, use_adjusted: bool = False, fetch=http_get):
        self.token = token or os.environ.get("EODHD_API_TOKEN")
        self.use_adjusted = use_adjusted  # unadjusted close matches reported (unadjusted) EPS
        self.fetch = fetch

    @property
    def license(self) -> LicenseInfo:
        return license_from_env("eodhd", "TENBAGGER_EODHD_DISPLAY_LICENSE", TERMS,
                                "EODHD personal plans forbid showing data to end users.")

    def latest_prices(self, tickers: Iterable[str]) -> dict[str, PriceQuote]:
        if not self.token:
            raise MissingCredentials("set EODHD_API_TOKEN")
        wanted = norm_tickers(tickers)
        out: dict[str, PriceQuote] = {}
        for batch in chunks(wanted, 300):
            qs = urllib.parse.urlencode({"api_token": self.token, "fmt": "json", "symbols": ",".join(batch)})
            data = self.fetch(f"{BASE}?{qs}")
            if not isinstance(data, list):
                raise SourceError(f"eodhd: unexpected payload {str(data)[:200]}")
            for row in data:
                t = str(row.get("code", "")).upper()
                px = row.get("adjusted_close" if self.use_adjusted else "close")
                if t in batch and px:
                    out[t] = PriceQuote(t, float(px), str(row.get("date", "")), source=self.name)
        return out
