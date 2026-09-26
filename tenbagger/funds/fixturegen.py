"""Generate SAMPLE N-PORT-shaped fixtures in ``data/fixtures/nport/``.

!!! These are NOT real filings. !!!
Weights are rough, from-memory approximations of each fund's largest positions, written
in the public N-PORT-P XML layout so the parser, mapping and look-through code can be
exercised offline. Every fund built from them is flagged ``is_sample: true``. Replace them
with live N-PORT pulls (``python -m funds build`` without ``--offline``) whenever
``www.sec.gov`` is reachable.

Positions beyond the top ~15–25 are collapsed into one "SAMPLE AGGREGATE" line so the
asset mix still adds up; the builder skips that line for top holdings and exposures.
"""
from __future__ import annotations

import json
from pathlib import Path
from xml.sax.saxutils import escape, quoteattr

from .reference import CUSIP_TO_TICKER

FIXTURE_DIR = Path(__file__).resolve().parent.parent / "data" / "fixtures" / "nport"
AGGREGATE_PREFIX = "SAMPLE AGGREGATE"
_TICKER_TO_CUSIP = {v: k for k, v in CUSIP_TO_TICKER.items()}

# (ticker, issuer name as N-PORT filers typically write it, pct of net assets)
SAMPLE: dict[str, dict] = {
    "VOO": {
        "reg": "VANGUARD INDEX FUNDS", "series": "Vanguard 500 Index Fund", "sid": "S000002839",
        "net": 1.40e12, "count": 505, "style": "ticker", "cash": 0.10,
        "rows": [
            ("NVDA", "NVIDIA Corp", 7.30), ("MSFT", "Microsoft Corp", 6.70), ("AAPL", "Apple Inc", 5.80),
            ("AMZN", "Amazon.com Inc", 3.90), ("META", "Meta Platforms Inc", 3.00), ("AVGO", "Broadcom Inc", 2.50),
            ("GOOGL", "Alphabet Inc Class A", 2.00), ("TSLA", "Tesla Inc", 1.90), ("BRK.B", "Berkshire Hathaway Inc Class B", 1.70),
            ("GOOG", "Alphabet Inc Class C", 1.60), ("JPM", "JPMorgan Chase & Co", 1.50), ("LLY", "Eli Lilly & Co", 1.20),
            ("V", "Visa Inc", 1.10), ("NFLX", "Netflix Inc", 0.90), ("XOM", "Exxon Mobil Corp", 0.90),
            ("MA", "Mastercard Inc", 0.90), ("COST", "Costco Wholesale Corp", 0.90), ("WMT", "Walmart Inc", 0.90),
            ("JNJ", "Johnson & Johnson", 0.80), ("PG", "Procter & Gamble Co/The", 0.70), ("HD", "Home Depot Inc/The", 0.70),
            ("ABBV", "AbbVie Inc", 0.70), ("BAC", "Bank of America Corp", 0.60), ("UNH", "UnitedHealth Group Inc", 0.50),
            ("KO", "Coca-Cola Co/The", 0.50), ("MU", "Micron Technology Inc", 0.25),
        ],
    },
    "VTI": {
        "reg": "VANGUARD INDEX FUNDS", "series": "Vanguard Total Stock Market Index Fund", "sid": "S000002848",
        "net": 1.90e12, "count": 3580, "style": "cusip", "cash": 0.20,
        "rows": [
            ("NVDA", "NVIDIA Corp", 6.30), ("MSFT", "Microsoft Corp", 5.90), ("AAPL", "Apple Inc", 5.00),
            ("AMZN", "Amazon.com Inc", 3.40), ("META", "Meta Platforms Inc", 2.60), ("AVGO", "Broadcom Inc", 2.20),
            ("GOOGL", "Alphabet Inc Class A", 1.70), ("TSLA", "Tesla Inc", 1.60), ("BRK.B", "Berkshire Hathaway Inc Class B", 1.50),
            ("GOOG", "Alphabet Inc Class C", 1.40), ("JPM", "JPMorgan Chase & Co", 1.30), ("LLY", "Eli Lilly & Co", 1.00),
            ("V", "Visa Inc", 0.95), ("XOM", "Exxon Mobil Corp", 0.80), ("COST", "Costco Wholesale Corp", 0.78),
            ("JNJ", "Johnson & Johnson", 0.70), ("PG", "Procter & Gamble Co/The", 0.62), ("KO", "Coca-Cola Co/The", 0.44),
            ("MU", "Micron Technology Inc", 0.22),
        ],
    },
    "QQQ": {
        "reg": "INVESCO QQQ TRUST, SERIES 1", "series": "Invesco QQQ Trust, Series 1", "sid": "S000000000",
        "net": 3.60e11, "count": 101, "style": "ticker", "cash": 0.05,
        "rows": [
            ("NVDA", "NVIDIA Corp", 9.00), ("MSFT", "Microsoft Corp", 8.60), ("AAPL", "Apple Inc", 7.60),
            ("AMZN", "Amazon.com Inc", 5.50), ("AVGO", "Broadcom Inc", 5.00), ("META", "Meta Platforms Inc", 3.70),
            ("NFLX", "Netflix Inc", 3.00), ("TSLA", "Tesla Inc", 2.80), ("GOOGL", "Alphabet Inc Class A", 2.60),
            ("COST", "Costco Wholesale Corp", 2.60), ("GOOG", "Alphabet Inc Class C", 2.50), ("PLTR", "Palantir Technologies Inc", 2.10),
            ("AMD", "Advanced Micro Devices Inc", 1.60), ("CSCO", "Cisco Systems Inc", 1.50), ("TMUS", "T-Mobile US Inc", 1.50),
            ("MU", "Micron Technology Inc", 0.80),
        ],
    },
    "SCHD": {
        "reg": "SCHWAB STRATEGIC TRUST", "series": "Schwab U.S. Dividend Equity ETF", "sid": "S000033650",
        "net": 7.0e10, "count": 103, "style": "name", "cash": 0.15,
        "rows": [
            ("CVX", "Chevron Corp", 4.30), ("KO", "Coca-Cola Co/The", 4.20), ("COP", "ConocoPhillips", 4.10),
            ("ABBV", "AbbVie Inc", 4.00), ("MO", "Altria Group Inc", 4.00), ("PEP", "PepsiCo Inc", 3.90),
            ("VZ", "Verizon Communications Inc", 3.90), ("HD", "Home Depot Inc/The", 3.90), ("CSCO", "Cisco Systems Inc", 3.90),
            ("AMGN", "Amgen Inc", 3.80), ("MRK", "Merck & Co Inc", 3.70), ("LMT", "Lockheed Martin Corp", 3.60),
            ("BMY", "Bristol-Myers Squibb Co", 3.50), ("TXN", "Texas Instruments Inc", 3.40), ("UPS", "United Parcel Service Inc Class B", 3.10),
        ],
    },
    "XLV": {
        "reg": "SELECT SECTOR SPDR TRUST", "series": "The Health Care Select Sector SPDR Fund", "sid": "S000006410",
        "net": 3.4e10, "count": 61, "style": "ticker", "cash": 0.10,
        "rows": [
            ("LLY", "Eli Lilly & Co", 12.00), ("JNJ", "Johnson & Johnson", 7.50), ("ABBV", "AbbVie Inc", 6.50),
            ("UNH", "UnitedHealth Group Inc", 5.00), ("ABT", "Abbott Laboratories", 4.50), ("MRK", "Merck & Co Inc", 4.00),
            ("TMO", "Thermo Fisher Scientific Inc", 3.70), ("ISRG", "Intuitive Surgical Inc", 3.60), ("AMGN", "Amgen Inc", 3.20),
            ("BSX", "Boston Scientific Corp", 3.00), ("DHR", "Danaher Corp", 2.80), ("GILD", "Gilead Sciences Inc", 2.80),
            ("PFE", "Pfizer Inc", 2.80), ("SYK", "Stryker Corp", 2.70), ("VRTX", "Vertex Pharmaceuticals Inc", 2.30),
        ],
    },
    "XLE": {
        "reg": "SELECT SECTOR SPDR TRUST", "series": "The Energy Select Sector SPDR Fund", "sid": "S000006408",
        "net": 2.7e10, "count": 23, "style": "ticker", "cash": 0.10,
        "rows": [
            ("XOM", "Exxon Mobil Corp", 23.00), ("CVX", "Chevron Corp", 16.50), ("COP", "ConocoPhillips", 6.80),
            ("WMB", "Williams Cos Inc/The", 4.60), ("EOG", "EOG Resources Inc", 4.40), ("KMI", "Kinder Morgan Inc", 4.30),
            ("SLB", "Schlumberger NV", 3.90), ("PSX", "Phillips 66", 3.80), ("MPC", "Marathon Petroleum Corp", 3.60),
            ("OKE", "ONEOK Inc", 3.30), ("VLO", "Valero Energy Corp", 3.20), ("BKR", "Baker Hughes Co", 3.10),
        ],
    },
    "GLD": {
        "reg": "SPDR GOLD TRUST", "series": "SPDR Gold Shares", "sid": "S000000000",
        "net": 1.0e11, "count": 1, "style": "ticker", "cash": 0.0,
        "rows": [],
        "commodity": [("Gold bullion (London Good Delivery bars)", 100.0)],
    },
    "HACK": {
        "reg": "ETF MANAGERS GROUP COMMODITY TRUST / AMPLIFY ETF TRUST", "series": "Amplify Cybersecurity ETF", "sid": "S000000000",
        "net": 2.2e9, "count": 60, "style": "ticker", "cash": 0.30,
        "rows": [
            ("AVGO", "Broadcom Inc", 6.00), ("CSCO", "Cisco Systems Inc", 5.50), ("PANW", "Palo Alto Networks Inc", 5.00),
            ("CRWD", "CrowdStrike Holdings Inc", 5.00), ("FTNT", "Fortinet Inc", 4.50), ("NET", "Cloudflare Inc", 4.00),
            ("ZS", "Zscaler Inc", 3.50), ("OKTA", "Okta Inc", 3.00), ("GEN", "Gen Digital Inc", 3.00),
            ("CHKP", "Check Point Software Technologies Ltd", 3.00), ("CYBR", "CyberArk Software Ltd", 3.00),
            ("QLYS", "Qualys Inc", 2.20), ("MSFT", "Microsoft Corp", 2.00),
        ],
    },
}

# Sample prospectus fee-table iXBRL (tiny excerpt shape). Values are approximate, flagged sample.
SAMPLE_RR = {
    "VOO": ("vif", "C000092055", "0.03"),
    "SCHD": ("sst", "C000102844", "0.06"),
}

_NS = ('xmlns="http://www.sec.gov/edgar/nport" xmlns:com="http://www.sec.gov/edgar/common" '
       'xmlns:ncom="http://www.sec.gov/edgar/nportcommon"')


def _sec_xml(name: str, ticker: str | None, pct: float, net: float, style: str,
             asset_cat: str = "EC", issuer_cat: str = "CORP", commodity: bool = False) -> str:
    val = round(net * pct / 100.0, 2)
    cusip = _TICKER_TO_CUSIP.get(ticker or "", "N/A")
    ids = []
    if style == "ticker" and ticker:
        if cusip != "N/A":
            ids.append(f'<isin value="US{cusip}0"/>')
        ids.append(f'<ticker value="{escape(ticker)}"/>')
    elif style == "cusip" and cusip != "N/A":
        ids.append(f'<isin value="US{cusip}0"/>')
    elif style == "cusip" and ticker:
        ids.append(f'<other otherDesc="Ticker" value="{escape(ticker)}"/>')
    elif style == "name" and ticker and cusip == "N/A":
        ids.append(f'<ticker value="{escape(ticker)}"/>')
    # style == "name" for our companies.json names: no identifiers and no CUSIP, so the
    # mapping must fall back to the issuer name (common in real filings).
    if style == "name":
        cusip = "N/A"
    ident = "".join(ids) or '<other otherDesc="Internal" value="SAMPLE"/>'
    asset = (f'<assetConditional assetCat="OTHER" desc="Gold bullion"/>' if commodity
             else f"<assetCat>{asset_cat}</assetCat>")
    return (
        "      <invstOrSec>\n"
        f"        <name>{escape(name)}</name><lei>N/A</lei><title>{escape(name)}</title>"
        f"<cusip>{cusip}</cusip>\n"
        f"        <identifiers>{ident}</identifiers>\n"
        f"        <balance>{round(val / 100.0, 0)}</balance><units>{'OU' if commodity else 'NS'}</units>"
        f"<curCd>USD</curCd><valUSD>{val}</valUSD><pctVal>{pct}</pctVal>\n"
        f"        <payoffProfile>Long</payoffProfile>{asset}"
        f"<issuerCat>{issuer_cat if not commodity else 'OTHER'}</issuerCat><invCountry>US</invCountry>\n"
        "        <isRestrictedSec>N</isRestrictedSec><fairValLevel>1</fairValLevel>\n"
        "      </invstOrSec>\n"
    )


def render(ticker: str, spec: dict, as_of: str = "2025-06-30") -> str:
    net = spec["net"]
    secs = []
    listed = 0.0
    for t, name, pct in spec["rows"]:
        secs.append(_sec_xml(name, t, pct, net, spec["style"]))
        listed += pct
    for name, pct in spec.get("commodity", []):
        secs.append(_sec_xml(name, None, pct, net, "none", commodity=True))
        listed += pct
    stiv = spec["cash"]
    if stiv:
        secs.append(_sec_xml("Money market sweep (sample)", None, stiv, net, "none",
                             asset_cat="STIV", issuer_cat="RF"))
        listed += stiv
    rest = round(100.0 - listed, 4)
    n_rest = spec["count"] - len(spec["rows"]) - len(spec.get("commodity", []))
    if rest > 0.0001 and n_rest > 0:
        secs.append(_sec_xml(f"{AGGREGATE_PREFIX}: remaining {n_rest} positions", None, rest, net, "none"))
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f"<!-- SAMPLE fixture for {ticker}: approximate weights from memory, NOT a real SEC filing. "
        "Replace with a live N-PORT-P pull. -->\n"
        f"<edgarSubmission {_NS}>\n"
        "  <headerData>\n    <submissionType>NPORT-P</submissionType>\n"
        f"    <filerInfo><seriesClassInfo><seriesId>{spec['sid']}</seriesId></seriesClassInfo></filerInfo>\n"
        "  </headerData>\n  <formData>\n    <genInfo>\n"
        f"      <regName>{escape(spec['reg'])}</regName><regCik>0000000000</regCik>\n"
        f"      <seriesName>{escape(spec['series'])}</seriesName><seriesId>{spec['sid']}</seriesId>\n"
        f"      <repPdEnd>2025-12-31</repPdEnd><repPdDate>{as_of}</repPdDate><isFinalFiling>N</isFinalFiling>\n"
        "    </genInfo>\n    <fundInfo>\n"
        f"      <totAssets>{net * 1.001:.2f}</totAssets><totLiabs>{net * 0.001:.2f}</totLiabs>"
        f"<netAssets>{net:.2f}</netAssets>\n"
        "    </fundInfo>\n    <invstOrSecs>\n" + "".join(secs) +
        "    </invstOrSecs>\n  </formData>\n</edgarSubmission>\n"
    )


def render_rr(prefix: str, class_id: str, pct: str) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<!-- SAMPLE prospectus fee-table excerpt (inline XBRL shape). Not a real filing. -->
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL"
      xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:xbrldi="http://xbrl.org/2006/xbrldi">
<body>
<ix:header><ix:resources>
  <xbrli:context id="c_{class_id}"><xbrli:entity><xbrli:identifier scheme="http://www.sec.gov/CIK">0000000000</xbrli:identifier>
    <xbrli:segment><xbrldi:explicitMember dimension="oef:ClassAxis">{prefix}:{class_id}Member</xbrldi:explicitMember></xbrli:segment>
  </xbrli:entity><xbrli:period><xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period></xbrli:context>
  <xbrli:context id="c_other"><xbrli:entity><xbrli:identifier scheme="http://www.sec.gov/CIK">0000000000</xbrli:identifier>
    <xbrli:segment><xbrldi:explicitMember dimension="oef:ClassAxis">{prefix}:C000999999Member</xbrldi:explicitMember></xbrli:segment>
  </xbrli:entity><xbrli:period><xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period></xbrli:context>
</ix:resources></ix:header>
<table>
 <tr><td>Management fees</td><td><ix:nonFraction name="oef:ManagementFeesOverAssets" contextRef="c_{class_id}" unitRef="pure" scale="-2" decimals="4">{pct}</ix:nonFraction>%</td></tr>
 <tr><td>Total annual fund operating expenses</td><td><ix:nonFraction name="oef:ExpensesOverAssets" contextRef="c_{class_id}" unitRef="pure" scale="-2" decimals="4">{pct}</ix:nonFraction>%</td></tr>
 <tr><td>Other share class (ignored)</td><td><ix:nonFraction name="oef:ExpensesOverAssets" contextRef="c_other" unitRef="pure" scale="-2" decimals="4">0.14</ix:nonFraction>%</td></tr>
</table>
</body></html>
"""


def write_fixtures(out_dir: Path = FIXTURE_DIR) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    meta = {"_note": "SAMPLE fixtures (approximate, from memory). Not real SEC filings. "
                     "Replace with live N-PORT pulls.",
            "aggregate_prefix": AGGREGATE_PREFIX, "funds": {}}
    for ticker, spec in SAMPLE.items():
        p = out_dir / f"{ticker}.xml"
        p.write_text(render(ticker, spec), encoding="utf-8")
        written.append(p)
        meta["funds"][ticker] = {"holdings_count": spec["count"],
                                 "class_id": SAMPLE_RR.get(ticker, (None, None))[1]}
    for ticker, (prefix, cid, pct) in SAMPLE_RR.items():
        p = out_dir / f"{ticker}.rr.htm"
        p.write_text(render_rr(prefix, cid, pct), encoding="utf-8")
        written.append(p)
    mp = out_dir / "meta.json"
    mp.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    written.append(mp)
    return written
