"""Interfaces shared by all adapters."""
from __future__ import annotations

import math
import os
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from typing import Iterable


class SourceError(RuntimeError):
    """A source failed (network, bad payload, unknown ticker...)."""


class MissingCredentials(SourceError):
    """Required API key env var is not set."""


class LicenseError(SourceError):
    """Data would be published without display/redistribution rights."""


@dataclass(frozen=True)
class LicenseInfo:
    """What we are allowed to do with a source's data.

    display_allowed: may be shown to (paying) end users of the app.
    license_ref:     free-text proof, e.g. "EODHD B2B order #123, signed 2026-10-01"
                     or "public domain (SEC)"; recorded in the publish manifest.
    """
    source: str
    display_allowed: bool
    license_ref: str = ""
    terms_url: str = ""
    notes: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


def license_from_env(source: str, env_var: str, terms_url: str, default_note: str) -> LicenseInfo:
    """Vendor feeds default to NOT displayable. The founder opts in by setting
    ``env_var`` to a reference for the signed display agreement (never just "1")."""
    ref = (os.environ.get(env_var) or "").strip()
    ok = bool(ref) and ref.lower() not in {"0", "false", "no", "1", "true", "yes"}
    return LicenseInfo(source=source, display_allowed=ok, license_ref=ref if ok else "",
                       terms_url=terms_url,
                       notes=("display agreement recorded via " + env_var) if ok else
                       f"{default_note} Set {env_var}='<contract reference>' once a display "
                       "license is signed.")


@dataclass
class PriceQuote:
    ticker: str
    price: float
    price_date: str          # YYYY-MM-DD (exchange date of the close / last trade)
    source: str
    is_sample: bool = False
    extra: dict = field(default_factory=dict)

    def __post_init__(self):
        self.ticker = self.ticker.strip().upper()
        if not isinstance(self.price, (int, float)) or isinstance(self.price, bool) \
                or not math.isfinite(self.price) or self.price <= 0:
            raise SourceError(f"{self.ticker}: bad price {self.price!r} from {self.source}")
        if len(self.price_date or "") < 10:
            raise SourceError(f"{self.ticker}: bad price_date {self.price_date!r} from {self.source}")
        self.price_date = self.price_date[:10]


class PriceSource(ABC):
    name: str = "abstract"

    @property
    @abstractmethod
    def license(self) -> LicenseInfo: ...

    @property
    def license_allows_display(self) -> bool:
        return self.license.display_allowed

    @abstractmethod
    def latest_prices(self, tickers: Iterable[str]) -> dict[str, PriceQuote]:
        """Return {TICKER: PriceQuote} for the tickers the source knows (missing = omitted)."""


class FundamentalsSource(ABC):
    name: str = "abstract"

    @property
    @abstractmethod
    def license(self) -> LicenseInfo: ...

    @property
    def license_allows_display(self) -> bool:
        return self.license.display_allowed

    @abstractmethod
    def annual_fundamentals(self, cik: int) -> dict[int, dict[str, float]]:
        """Return {fiscal_year: {contract_field: value}} (raw USD, shares raw count)."""


def chunks(seq: list, n: int):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def norm_tickers(tickers: Iterable[str]) -> list[str]:
    return list(dict.fromkeys(t.strip().upper() for t in tickers if t and t.strip()))
