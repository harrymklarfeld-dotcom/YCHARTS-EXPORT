"""Tenbagger data-source adapters (prices + fundamentals) with a display-license gate.

Everything here is stdlib-only and runs from ``tenbagger/``::

    python -m datasources --help

Design
- ``PriceSource`` / ``FundamentalsSource`` (base.py) are the two interfaces.
- Every source carries a ``LicenseInfo``. ``display_allowed`` is True only for data we
  may legally show to paying end users (SEC public data; a vendor feed only after the
  founder records a signed display/redistribution agreement in an env var).
- ``python -m datasources gate`` refuses to publish a companies.json whose real
  (non-sample) prices came from a source without display rights.
- The ``pipeline`` package (owned elsewhere) turns EDGAR companyfacts into
  data/companies.json; this package feeds it a prices CSV (``--prices``) and, for bulk
  runs, a companyfacts-shaped cache built from the SEC Financial Statement Data Sets.
"""
from .base import (FundamentalsSource, LicenseError, LicenseInfo, MissingCredentials,
                   PriceQuote, PriceSource, SourceError)

__all__ = ["FundamentalsSource", "LicenseError", "LicenseInfo", "MissingCredentials",
           "PriceQuote", "PriceSource", "SourceError"]
