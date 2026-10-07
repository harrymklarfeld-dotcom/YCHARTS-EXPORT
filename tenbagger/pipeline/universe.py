"""Bundled ticker universes with hardcoded CIK / sector / industry.

`sp500-sample` is ~40 well-known US large caps spread across sectors. CIKs are
the SEC central index keys used by the companyfacts endpoint.
"""
from __future__ import annotations

# ticker: (cik, name, sector, industry)
SP500_SAMPLE: dict[str, tuple[int, str, str, str]] = {
    "AAPL": (320193, "Apple Inc.", "Technology", "Consumer Electronics"),
    "MSFT": (789019, "Microsoft Corporation", "Technology", "Software"),
    "NVDA": (1045810, "NVIDIA Corporation", "Technology", "Semiconductors"),
    "MU": (723125, "Micron Technology, Inc.", "Technology", "Semiconductors"),
    "AMD": (2488, "Advanced Micro Devices, Inc.", "Technology", "Semiconductors"),
    "INTC": (50863, "Intel Corporation", "Technology", "Semiconductors"),
    "CSCO": (858877, "Cisco Systems, Inc.", "Technology", "Networking Equipment"),
    "ORCL": (1341439, "Oracle Corporation", "Technology", "Software"),
    "CRM": (1108524, "Salesforce, Inc.", "Technology", "Software"),
    "GOOGL": (1652044, "Alphabet Inc.", "Communication Services", "Internet Content"),
    "META": (1326801, "Meta Platforms, Inc.", "Communication Services", "Internet Content"),
    "NFLX": (1065280, "Netflix, Inc.", "Communication Services", "Entertainment"),
    "DIS": (1744489, "The Walt Disney Company", "Communication Services", "Entertainment"),
    "VZ": (732712, "Verizon Communications Inc.", "Communication Services", "Telecom Services"),
    "T": (732717, "AT&T Inc.", "Communication Services", "Telecom Services"),
    "AMZN": (1018724, "Amazon.com, Inc.", "Consumer Discretionary", "Internet Retail"),
    "TSLA": (1318605, "Tesla, Inc.", "Consumer Discretionary", "Automobiles"),
    "HD": (354950, "The Home Depot, Inc.", "Consumer Discretionary", "Home Improvement Retail"),
    "MCD": (63908, "McDonald's Corporation", "Consumer Discretionary", "Restaurants"),
    "NKE": (320187, "NIKE, Inc.", "Consumer Discretionary", "Footwear & Apparel"),
    "SBUX": (829224, "Starbucks Corporation", "Consumer Discretionary", "Restaurants"),
    "COST": (909832, "Costco Wholesale Corporation", "Consumer Staples", "Discount Stores"),
    "WMT": (104169, "Walmart Inc.", "Consumer Staples", "Discount Stores"),
    "KO": (21344, "The Coca-Cola Company", "Consumer Staples", "Beverages"),
    "PEP": (77476, "PepsiCo, Inc.", "Consumer Staples", "Beverages"),
    "PG": (80424, "The Procter & Gamble Company", "Consumer Staples", "Household Products"),
    "JPM": (19617, "JPMorgan Chase & Co.", "Financials", "Banks"),
    "BAC": (70858, "Bank of America Corporation", "Financials", "Banks"),
    "V": (1403161, "Visa Inc.", "Financials", "Payments"),
    "MA": (1141391, "Mastercard Incorporated", "Financials", "Payments"),
    "JNJ": (200406, "Johnson & Johnson", "Health Care", "Pharmaceuticals"),
    "LLY": (59478, "Eli Lilly and Company", "Health Care", "Pharmaceuticals"),
    "PFE": (78003, "Pfizer Inc.", "Health Care", "Pharmaceuticals"),
    "MRK": (310158, "Merck & Co., Inc.", "Health Care", "Pharmaceuticals"),
    "ABBV": (1551152, "AbbVie Inc.", "Health Care", "Pharmaceuticals"),
    "UNH": (731766, "UnitedHealth Group Incorporated", "Health Care", "Managed Health Care"),
    "XOM": (34088, "Exxon Mobil Corporation", "Energy", "Oil & Gas Integrated"),
    "CVX": (93410, "Chevron Corporation", "Energy", "Oil & Gas Integrated"),
    "CAT": (18230, "Caterpillar Inc.", "Industrials", "Machinery"),
    "BA": (12927, "The Boeing Company", "Industrials", "Aerospace & Defense"),
    "UPS": (1090727, "United Parcel Service, Inc.", "Industrials", "Logistics"),
    "NEE": (753308, "NextEra Energy, Inc.", "Utilities", "Utilities"),
    "LIN": (1707925, "Linde plc", "Materials", "Industrial Gases"),
}

UNIVERSES = {"sp500-sample": SP500_SAMPLE}


def lookup(ticker: str):
    """Return (cik, name, sector, industry) for a bundled ticker, else None."""
    return SP500_SAMPLE.get(ticker.upper())
