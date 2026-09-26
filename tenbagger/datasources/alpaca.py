"""Alpaca Market Data v2 (latest daily bar). Free "Basic" plan = IEX feed only.

Endpoint: GET https://data.alpaca.markets/v2/stocks/bars/latest?symbols=A,B&feed=iex
Auth headers: APCA-API-KEY-ID / APCA-API-SECRET-KEY  (env ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY)

LICENCE: Alpaca's support article "Can I redistribute Alpaca API data via my platform?"
answers no. Treat as internal/dev only. Display requires a separate agreement (e.g. as a
Broker API partner) recorded in TENBAGGER_ALPACA_DISPLAY_LICENSE.
"""
from __future__ import annotations

import os
import urllib.parse
from typing import Iterable

from .base import (LicenseInfo, MissingCredentials, PriceQuote, PriceSource, SourceError, chunks,
                   license_from_env, norm_tickers)
from .http import http_get

BASE = "https://data.alpaca.markets/v2/stocks/bars/latest"
TERMS = "https://alpaca.markets/support/redistribute-alpaca-api"


def _alpaca_symbol(t: str) -> str:
    return t.replace("-", ".")  # Alpaca uses BRK.B; SEC uses BRK-B


class AlpacaPriceSource(PriceSource):
    name = "alpaca"

    def __init__(self, key_id: str | None = None, secret: str | None = None, feed: str | None = None,
                 fetch=http_get):
        self.key_id = key_id or os.environ.get("ALPACA_API_KEY_ID")
        self.secret = secret or os.environ.get("ALPACA_API_SECRET_KEY")
        self.feed = feed or os.environ.get("ALPACA_FEED", "iex")
        self.fetch = fetch

    @property
    def license(self) -> LicenseInfo:
        return license_from_env("alpaca", "TENBAGGER_ALPACA_DISPLAY_LICENSE", TERMS,
                                "Alpaca market data may not be redistributed (internal use only).")

    def latest_prices(self, tickers: Iterable[str]) -> dict[str, PriceQuote]:
        if not (self.key_id and self.secret):
            raise MissingCredentials("set ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY")
        wanted = {_alpaca_symbol(t): t for t in norm_tickers(tickers)}
        out: dict[str, PriceQuote] = {}
        for batch in chunks(list(wanted), 200):
            qs = urllib.parse.urlencode({"symbols": ",".join(batch), "feed": self.feed})
            data = self.fetch(f"{BASE}?{qs}", headers={"APCA-API-KEY-ID": self.key_id,
                                                       "APCA-API-SECRET-KEY": self.secret})
            if not isinstance(data, dict) or "bars" not in data:
                raise SourceError(f"alpaca: unexpected payload {str(data)[:200]}")
            for sym, bar in (data.get("bars") or {}).items():
                t = wanted.get(sym)
                if t and bar and bar.get("c"):
                    out[t] = PriceQuote(t, float(bar["c"]), str(bar.get("t", ""))[:10], source=self.name,
                                        extra={"feed": self.feed})
        return out
