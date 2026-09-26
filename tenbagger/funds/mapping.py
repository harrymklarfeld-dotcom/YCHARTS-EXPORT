"""Map N-PORT positions to tickers, and where possible to our ``companies.json`` tickers.

Order of evidence (first hit wins):
1. the position's own ticker identifier (``<identifiers><ticker value=…/>``)
2. CUSIP → ticker from ``reference.CUSIP_TO_TICKER`` (also the CUSIP embedded in a US ISIN)
3. normalised issuer name == normalised ``companies.json`` name
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from .nport import Holding
from .reference import CUSIP_TO_TICKER

_SUFFIXES = {
    "inc", "incorporated", "corp", "corporation", "co", "company", "companies", "the", "plc",
    "ltd", "limited", "llc", "lp", "sa", "nv", "ag", "se", "holdings", "holding", "group",
    "class", "cl", "a", "b", "c", "com", "common", "stock", "shs", "new", "del", "de",
}


def normalize_name(name: str | None) -> str:
    if not name:
        return ""
    s = name.lower().replace("/the", " ").replace("&", " and ")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    words = [w for w in s.split() if w]
    # strip suffix words from the end (and a leading "the")
    while words and words[-1] in _SUFFIXES | {"and"}:
        words.pop()
    if words and words[0] == "the":
        words = words[1:]
    return " ".join(words)


def _isin_cusip(isin: str | None) -> str | None:
    if isin and len(isin) == 12 and isin[:2] in ("US", "CA"):
        return isin[2:11]
    return None


@dataclass
class Mapper:
    known_tickers: set[str]
    name_index: dict[str, str]

    @classmethod
    def from_companies(cls, companies: list[dict]) -> "Mapper":
        tickers = {str(c.get("ticker", "")).upper() for c in companies if c.get("ticker")}
        index = {}
        for c in companies:
            n = normalize_name(c.get("name"))
            if n and c.get("ticker"):
                index[n] = str(c["ticker"]).upper()
        return cls(tickers, index)

    def ticker_for(self, h: Holding) -> str | None:
        """Best ticker for a position (any ticker, not only ones in companies.json)."""
        if h.ticker:
            return h.ticker.replace("/", ".").upper()
        for cusip in (h.cusip, _isin_cusip(h.isin)):
            if cusip and cusip.upper() in CUSIP_TO_TICKER:
                return CUSIP_TO_TICKER[cusip.upper()]
        n = normalize_name(h.name) or normalize_name(h.title)
        if n and n in self.name_index:
            return self.name_index[n]
        return None

    def company_ticker(self, h: Holding) -> str | None:
        """Ticker only if it is one of our companies.json tickers."""
        t = self.ticker_for(h)
        if t and t in self.known_tickers:
            return t
        # a ticker identifier that is not ours may still name-match (e.g. share-class suffix)
        n = normalize_name(h.name)
        return self.name_index.get(n) if n else None
