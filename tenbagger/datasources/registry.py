"""Name -> adapter factory."""
from __future__ import annotations

from .alpaca import AlpacaPriceSource
from .base import PriceSource, SourceError
from .eodhd import EodhdPriceSource
from .fmp import FmpPriceSource
from .intrinio import IntrinioPriceSource

PRICE_SOURCES = {"alpaca": AlpacaPriceSource, "eodhd": EodhdPriceSource,
                 "intrinio": IntrinioPriceSource, "fmp": FmpPriceSource}


def price_source(name: str, **kw) -> PriceSource:
    try:
        return PRICE_SOURCES[name](**kw)
    except KeyError:
        raise SourceError(f"unknown price source {name!r}; choose from {sorted(PRICE_SOURCES)} or csv") from None
