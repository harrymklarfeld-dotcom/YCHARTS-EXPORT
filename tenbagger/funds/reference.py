"""Hand-maintained reference tables for the fund builder.

Everything here is our own, from public identifiers:
- ``FUNDS``: the fund universe with OUR simple category labels (not any vendor's
  classification) and the issuer name.
- ``CUSIP_TO_TICKER``: public CUSIPs of common large holdings, so N-PORT rows that carry no
  ticker identifier can still map to ``companies.json``. Live builds can extend this with
  OpenFIGI (free) later.
- ``SECTOR_HINTS``: our sector labels (same vocabulary as ``datasources/sic.py``) for big
  holdings that are not (yet) in ``companies.json``. Used only for fund sector weights.
"""
from __future__ import annotations

from dataclasses import dataclass, field

CATEGORIES = (
    "US Large Cap",
    "Total Market",
    "Nasdaq-100",
    "Dividend",
    "Sector – Health Care",
    "Sector – Energy",
    "Gold",
    "Cybersecurity",
)


@dataclass(frozen=True)
class FundSpec:
    ticker: str
    name: str
    issuer: str
    category: str
    # Some ETFs are not '40-Act funds and never file N-PORT (unit investment trusts such as
    # QQQ, grantor trusts such as GLD). For those, a live build can use a sibling '40-Act fund
    # tracking the same index (nport_proxy) or keeps the sample fixture.
    nport_proxy: str | None = None
    files_nport: bool = True
    note: str | None = None
    # Sample expense ratio (decimal) used only when no prospectus iXBRL is available.
    sample_expense_ratio: float | None = None
    aliases: tuple[str, ...] = field(default_factory=tuple)


FUNDS: tuple[FundSpec, ...] = (
    FundSpec("VOO", "Vanguard S&P 500 ETF", "Vanguard", "US Large Cap", sample_expense_ratio=0.0003),
    FundSpec("VTI", "Vanguard Total Stock Market ETF", "Vanguard", "Total Market", sample_expense_ratio=0.0003),
    FundSpec("QQQ", "Invesco QQQ Trust", "Invesco", "Nasdaq-100", nport_proxy="QQQM", files_nport=False,
             note="QQQ is a unit investment trust and does not file N-PORT; live builds read "
                  "QQQM (same index, open-end fund) instead.",
             sample_expense_ratio=0.0020),
    FundSpec("SCHD", "Schwab U.S. Dividend Equity ETF", "Schwab", "Dividend", sample_expense_ratio=0.0006),
    FundSpec("XLV", "Health Care Select Sector SPDR Fund", "State Street", "Sector – Health Care", sample_expense_ratio=0.0008),
    FundSpec("XLE", "Energy Select Sector SPDR Fund", "State Street", "Sector – Energy", sample_expense_ratio=0.0008),
    FundSpec("GLD", "SPDR Gold Shares", "State Street", "Gold", files_nport=False,
             note="GLD is a grantor trust holding gold bars; it files 10-K/10-Q, not N-PORT. "
                  "Its holdings are modelled as a single commodity position.",
             sample_expense_ratio=0.0040),
    FundSpec("HACK", "Amplify Cybersecurity ETF", "Amplify", "Cybersecurity", sample_expense_ratio=0.0060),
)

FUND_BY_TICKER = {f.ticker: f for f in FUNDS}

# Public CUSIPs (9 chars). Only companies we are confident about.
CUSIP_TO_TICKER: dict[str, str] = {
    "037833100": "AAPL",
    "594918104": "MSFT",
    "67066G104": "NVDA",
    "023135106": "AMZN",
    "46625H100": "JPM",
    "30231G102": "XOM",
    "478160104": "JNJ",
    "88160R101": "TSLA",
    "191216100": "KO",
    "742718109": "PG",
    "22160K105": "COST",
    "595112103": "MU",
}

SECTOR_HINTS: dict[str, str] = {
    # Technology
    "AAPL": "Technology", "MSFT": "Technology", "NVDA": "Technology", "AVGO": "Technology",
    "AMD": "Technology", "CSCO": "Technology", "TXN": "Technology", "ORCL": "Technology",
    "CRM": "Technology", "ADBE": "Technology", "PLTR": "Technology", "MU": "Technology",
    "PANW": "Technology", "CRWD": "Technology", "FTNT": "Technology", "ZS": "Technology",
    "NET": "Technology", "OKTA": "Technology", "CHKP": "Technology", "CYBR": "Technology",
    "GEN": "Technology", "S": "Technology", "QLYS": "Technology", "INTU": "Technology",
    # Communication Services
    "META": "Communication Services", "GOOGL": "Communication Services",
    "GOOG": "Communication Services", "NFLX": "Communication Services",
    "TMUS": "Communication Services", "VZ": "Communication Services",
    # Consumer Discretionary
    "AMZN": "Consumer Discretionary", "TSLA": "Consumer Discretionary",
    "HD": "Consumer Discretionary", "BKNG": "Consumer Discretionary",
    # Consumer Staples
    "COST": "Consumer Staples", "WMT": "Consumer Staples", "PG": "Consumer Staples",
    "KO": "Consumer Staples", "PEP": "Consumer Staples", "MO": "Consumer Staples",
    # Financials
    "BRK.B": "Financials", "JPM": "Financials", "V": "Financials", "MA": "Financials",
    "BAC": "Financials",
    # Health Care
    "LLY": "Health Care", "JNJ": "Health Care", "ABBV": "Health Care", "UNH": "Health Care",
    "ABT": "Health Care", "MRK": "Health Care", "TMO": "Health Care", "ISRG": "Health Care",
    "AMGN": "Health Care", "BSX": "Health Care", "DHR": "Health Care", "GILD": "Health Care",
    "PFE": "Health Care", "SYK": "Health Care", "VRTX": "Health Care", "BMY": "Health Care",
    # Energy
    "XOM": "Energy", "CVX": "Energy", "COP": "Energy", "WMB": "Energy", "EOG": "Energy",
    "KMI": "Energy", "PSX": "Energy", "MPC": "Energy", "SLB": "Energy", "OKE": "Energy",
    "VLO": "Energy", "BKR": "Energy",
    # Industrials
    "LMT": "Industrials", "UPS": "Industrials", "GE": "Industrials", "CAT": "Industrials",
}
