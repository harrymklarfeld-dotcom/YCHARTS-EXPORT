"""Fill sector/industry left as "Unknown" by the pipeline, using public SEC SIC codes."""
from __future__ import annotations

from .sic import industry_for_sic, sector_for_sic


def enrich_sectors(doc: dict, sic_by_cik: dict[str, int]) -> int:
    n = 0
    for c in doc.get("companies", []):
        sic = sic_by_cik.get(str(c.get("cik")))
        if not sic:
            continue
        if c.get("sector") in (None, "", "Unknown") and sector_for_sic(sic):
            c["sector"] = sector_for_sic(sic)
            n += 1
        if c.get("industry") in (None, "", "Unknown") and industry_for_sic(sic):
            c["industry"] = industry_for_sic(sic)
    return n
