"""Map SEC SIC codes (public, from EDGAR) to Tenbagger's own plain-English sectors.

We deliberately do NOT use GICS: GICS is proprietary to MSCI / S&P Dow Jones Indices and
commercial display needs a licence. SIC codes are assigned by the SEC and are public.
"""
from __future__ import annotations

# (lo, hi, sector) - first match wins, so specific ranges come before broad ones.
_RANGES: list[tuple[int, int, str]] = [
    (2830, 2836, "Health Care"), (3840, 3851, "Health Care"), (5047, 5047, "Health Care"),
    (5122, 5122, "Health Care"), (6324, 6324, "Health Care"), (8000, 8099, "Health Care"),
    (8731, 8734, "Health Care"),
    (3570, 3579, "Technology"), (3660, 3679, "Technology"), (3690, 3699, "Technology"),
    (3820, 3829, "Technology"), (7370, 7379, "Technology"), (3559, 3559, "Technology"),
    (4800, 4899, "Communication Services"), (2710, 2741, "Communication Services"),
    (7810, 7849, "Communication Services"), (7900, 7999, "Communication Services"),
    (1300, 1399, "Energy"), (2900, 2999, "Energy"), (4610, 4619, "Energy"), (4922, 4925, "Energy"),
    (4900, 4991, "Utilities"),
    (6000, 6799, "Financials"),
    (2000, 2199, "Consumer Staples"), (2840, 2844, "Consumer Staples"), (5140, 5149, "Consumer Staples"),
    (5400, 5499, "Consumer Staples"), (5331, 5331, "Consumer Staples"), (5399, 5399, "Consumer Staples"),
    (5912, 5912, "Consumer Staples"),
    (3710, 3716, "Consumer Discretionary"), (2300, 2399, "Consumer Discretionary"),
    (3020, 3021, "Consumer Discretionary"), (5000, 5999, "Consumer Discretionary"),
    (7000, 7099, "Consumer Discretionary"), (1520, 1531, "Consumer Discretionary"),
    (2800, 2899, "Materials"), (1000, 1499, "Materials"), (2400, 2699, "Materials"),
    (3200, 3399, "Materials"),
    (3720, 3729, "Industrials"), (3760, 3769, "Industrials"), (3500, 3599, "Industrials"),
    (4000, 4799, "Industrials"), (1500, 1799, "Industrials"), (3400, 3499, "Industrials"),
    (3600, 3659, "Industrials"), (3700, 3799, "Industrials"), (7300, 7399, "Industrials"),
    (8700, 8799, "Industrials"),
]

INDUSTRY: dict[int, str] = {
    1311: "Oil & Gas Production", 2080: "Beverages", 2086: "Beverages", 2834: "Pharmaceuticals",
    2836: "Biotechnology", 2911: "Oil Refining", 3571: "Computers", 3572: "Computer Storage",
    3576: "Networking Equipment", 3661: "Telecom Equipment", 3663: "Communications Equipment",
    3674: "Semiconductors", 3711: "Automobiles", 3721: "Aircraft", 3812: "Aerospace & Defense",
    3841: "Medical Devices", 4813: "Telecom Services", 4911: "Electric Utilities",
    5331: "Discount Stores", 5812: "Restaurants", 5961: "Internet Retail", 6021: "Banks",
    6022: "Banks", 6199: "Financial Services", 6311: "Life Insurance", 6324: "Health Insurance",
    6331: "Property & Casualty Insurance", 6798: "REITs", 7370: "Software & Internet",
    7372: "Software", 7374: "Data Processing", 2840: "Household Products",
}


def sector_for_sic(sic: int | str | None) -> str | None:
    try:
        s = int(sic)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    for lo, hi, name in _RANGES:
        if lo <= s <= hi:
            return name
    return None


def industry_for_sic(sic: int | str | None) -> str | None:
    try:
        s = int(sic)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return INDUSTRY.get(s) or (f"SIC {s}" if s else None)
