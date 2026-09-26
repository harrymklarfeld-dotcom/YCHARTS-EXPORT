import json
import math
from pathlib import Path

import pytest

from funds.build import build, fund_record, load_fixture_meta, FIXTURE_DIR
from funds.fixturegen import AGGREGATE_PREFIX, render, render_rr, SAMPLE
from funds.lookthrough import look_through
from funds.mapping import Mapper, normalize_name
from funds.nport import Holding, NportFiling, allocation, parse_nport, parse_nport_file
from funds.reference import FUND_BY_TICKER
from funds.rr import expense_ratio, parse_rr_facts

COMPANIES = [
    {"ticker": "KO", "name": "The Coca-Cola Company", "sector": "Consumer Staples",
     "metrics": {"pe": 25.0, "earnings_yield": 0.04, "fcf_yield": 0.03, "roic": 0.20}},
    {"ticker": "XOM", "name": "Exxon Mobil Corporation", "sector": "Energy",
     "metrics": {"pe": 10.0, "earnings_yield": 0.10, "fcf_yield": 0.08, "roic": None}},
    {"ticker": "JPM", "name": "JPMorgan Chase & Co.", "sector": "Financials", "metrics": {}},
    {"ticker": "AAPL", "name": "Apple Inc.", "sector": "Technology",
     "metrics": {"pe": 20.0, "earnings_yield": 0.05, "fcf_yield": 0.04, "roic": 0.60}},
]

REAL_SHAPE = b"""<?xml version="1.0" encoding="UTF-8"?>
<edgarSubmission xmlns="http://www.sec.gov/edgar/nport" xmlns:com="http://www.sec.gov/edgar/common">
  <headerData><submissionType>NPORT-P</submissionType>
    <filerInfo><seriesClassInfo><seriesId>S000009999</seriesId><classId>C000011111</classId><classId>C000022222</classId></seriesClassInfo></filerInfo>
  </headerData>
  <formData>
    <genInfo><regName>EXAMPLE TRUST</regName><regCik>0000123456</regCik><seriesName>Example Equity ETF</seriesName>
      <seriesId>S000009999</seriesId><repPdEnd>2025-09-30</repPdEnd><repPdDate>2025-06-30</repPdDate></genInfo>
    <fundInfo><totAssets>1010.5</totAssets><totLiabs>10.5</totLiabs><netAssets>1000.0</netAssets></fundInfo>
    <invstOrSecs>
      <invstOrSec><name>Apple Inc</name><lei>X</lei><title>Apple Inc</title><cusip>037833100</cusip>
        <identifiers><isin value="US0378331005"/></identifiers>
        <balance>10</balance><units>NS</units><curCd>USD</curCd><valUSD>400</valUSD><pctVal>40.0</pctVal>
        <payoffProfile>Long</payoffProfile><assetCat>EC</assetCat><issuerCat>CORP</issuerCat><invCountry>US</invCountry></invstOrSec>
      <invstOrSec><name>Exxon Mobil Corp</name><title>Exxon</title><cusip>N/A</cusip>
        <identifiers><ticker value="xom"/></identifiers>
        <valUSD>300</valUSD><pctVal>30.0</pctVal><assetCat>EC</assetCat><issuerCat>CORP</issuerCat><invCountry>US</invCountry></invstOrSec>
      <invstOrSec><name>United States Treasury Note</name><cusip>91282CAB7</cusip><identifiers><isin value="US91282CAB71"/></identifiers>
        <valUSD>200</valUSD><pctVal>20.0</pctVal><assetCat>DBT</assetCat><issuerCat>UST</issuerCat><invCountry>US</invCountry></invstOrSec>
      <invstOrSec><name>Gold</name><cusip>000000000</cusip><identifiers><other otherDesc="none" value="x"/></identifiers>
        <valUSD>50</valUSD><pctVal>5.0</pctVal><assetConditional assetCat="OTHER" desc="Gold bullion"/>
        <issuerConditional issuerCat="OTHER" desc="n/a"/><invCountry>US</invCountry></invstOrSec>
      <invstOrSec><name>Weird row</name><pctVal>not-a-number</pctVal></invstOrSec>
    </invstOrSecs>
  </formData>
</edgarSubmission>"""


# ------------------------------------------------------------------ parsing

def test_parse_real_shape():
    f = parse_nport(REAL_SHAPE)
    assert f.series_name == "Example Equity ETF"
    assert f.series_id == "S000009999"
    assert f.class_ids == ["C000011111", "C000022222"]
    assert f.period_end == "2025-06-30"
    assert f.net_assets == 1000.0 and f.total_assets == 1010.5
    assert len(f.holdings) == 5
    aapl, xom, ust, gold, weird = f.holdings
    assert aapl.cusip == "037833100" and aapl.isin == "US0378331005" and aapl.ticker is None
    assert aapl.weight == pytest.approx(0.40) and aapl.value_usd == 400
    assert xom.ticker == "XOM" and xom.cusip is None
    assert ust.asset_cat == "DBT" and ust.issuer_cat == "UST"
    assert gold.asset_cat == "OTHER" and gold.asset_cat_desc == "Gold bullion" and gold.cusip is None
    assert gold.issuer_cat == "OTHER"
    assert weird.weight is None and weird.asset_cat is None


def test_parse_rejects_garbage_and_tolerates_empty():
    with pytest.raises(ValueError):
        parse_nport(b"not xml at all")
    f = parse_nport(b"<edgarSubmission/>")
    assert f.holdings == [] and f.net_assets is None and f.series_name is None


def test_allocation_sums_to_one_and_buckets():
    a = allocation(parse_nport(REAL_SHAPE))
    assert sum(a.values()) == pytest.approx(1.0, abs=1e-6)
    assert a["stock"] == pytest.approx(0.70)
    assert a["bond"] == pytest.approx(0.20)
    assert a["commodity"] == pytest.approx(0.05)   # "OTHER" with a gold description
    assert a["cash"] == pytest.approx(0.05)        # 100% − 95% listed = uninvested cash


def test_allocation_over_100_is_rescaled():
    f = NportFiling(holdings=[Holding("A", weight=0.8, asset_cat="EC"), Holding("B", weight=0.4, asset_cat="DBT")])
    a = allocation(f)
    assert sum(a.values()) == pytest.approx(1.0)
    assert a["stock"] == pytest.approx(0.8 / 1.2)


def test_allocation_short_positions_folded():
    f = NportFiling(holdings=[Holding("A", weight=1.1, asset_cat="EC"), Holding("S", weight=-0.2, asset_cat="DE")])
    a = allocation(f)
    assert all(v >= 0 for v in a.values())
    assert sum(a.values()) == pytest.approx(1.0)


@pytest.mark.parametrize("ticker", sorted(SAMPLE))
def test_every_fixture_allocation_sums_to_100(ticker):
    f = parse_nport_file(FIXTURE_DIR / f"{ticker}.xml")
    assert sum(allocation(f).values()) == pytest.approx(1.0, abs=1e-4)
    listed = sum(h.weight for h in f.holdings if h.weight is not None)
    assert listed == pytest.approx(1.0, abs=1e-4)


def test_fixture_matches_generator():
    """Committed fixtures must be what fixturegen renders (no silent hand edits)."""
    for t, spec in SAMPLE.items():
        assert (FIXTURE_DIR / f"{t}.xml").read_text(encoding="utf-8") == render(t, spec)


# ------------------------------------------------------------------ expense ratio

def test_expense_ratio_ixbrl_scale_and_class():
    doc = render_rr("vif", "C000092055", "0.03")
    facts = parse_rr_facts(doc)
    assert {f.concept for f in facts} == {"ExpensesOverAssets"}   # management fee ignored
    assert expense_ratio(doc, "C000092055") == pytest.approx(0.0003)
    assert expense_ratio(doc, "C000999999") == pytest.approx(0.0014)


def test_expense_ratio_prefers_net_and_handles_junk():
    doc = ('<xbrli:context id="a"><xbrldi:explicitMember dimension="x">p:C1Member</xbrldi:explicitMember></xbrli:context>'
           '<ix:nonFraction name="rr:ExpensesOverAssets" contextRef="a" scale="-2">0.50</ix:nonFraction>'
           '<ix:nonFraction name="rr:NetExpensesOverAssets" contextRef="a" scale="-2">0.45</ix:nonFraction>'
           '<ix:nonFraction name="rr:ExpensesOverAssets" contextRef="a" scale="-2">n/a</ix:nonFraction>')
    assert expense_ratio(doc, "C1") == pytest.approx(0.0045)
    assert expense_ratio("") is None
    assert expense_ratio("<html>no facts</html>") is None


# ------------------------------------------------------------------ mapping

def test_normalize_name():
    assert normalize_name("Coca-Cola Co/The") == normalize_name("The Coca-Cola Company") == "coca cola"
    assert normalize_name("JPMorgan Chase & Co") == normalize_name("JPMorgan Chase & Co.")
    assert normalize_name("Exxon Mobil Corp") == normalize_name("Exxon Mobil Corporation")
    assert normalize_name(None) == ""


def test_mapper_ticker_cusip_isin_name():
    m = Mapper.from_companies(COMPANIES)
    assert m.company_ticker(Holding("Whatever", ticker="XOM")) == "XOM"
    assert m.company_ticker(Holding("Apple Inc", cusip="037833100")) == "AAPL"
    assert m.company_ticker(Holding("Apple", isin="US0378331005")) == "AAPL"
    assert m.company_ticker(Holding("Coca-Cola Co/The")) == "KO"
    assert m.company_ticker(Holding("JPMorgan Chase & Co")) == "JPM"
    # identified but not one of ours
    assert m.ticker_for(Holding("Chevron", ticker="CVX")) == "CVX"
    assert m.company_ticker(Holding("Chevron", ticker="CVX")) is None
    assert m.company_ticker(Holding("Mystery Holdings Inc")) is None
    assert Mapper.from_companies([]).company_ticker(Holding("Apple Inc")) is None


# ------------------------------------------------------------------ look-through

def test_harmonic_pe_hand_checked():
    # 50% at P/E 10 (E/P 10%), 50% at P/E 20 (E/P 5%): E/P = 7.5% → P/E 13.33, not 15.
    lt = look_through([(0.5, {"pe": 10.0}), (0.5, {"pe": 20.0})])
    assert lt["weighted_pe"] == pytest.approx(13.3333, abs=1e-3)
    assert lt["coverage_pct"] == pytest.approx(1.0)


def test_harmonic_pe_includes_loss_makers_and_renormalises():
    # 0.2 @ E/P −5%, 0.2 @ E/P 10% → mean E/P 2.5% → P/E 40; coverage 40% of NAV.
    lt = look_through([(0.2, {"earnings_yield": -0.05, "pe": None}), (0.2, {"earnings_yield": 0.10})])
    assert lt["weighted_pe"] == pytest.approx(40.0)
    assert lt["coverage_pct"] == pytest.approx(0.4)
    # all losses → null, never negative or infinite
    assert look_through([(0.3, {"earnings_yield": -0.02})])["weighted_pe"] is None


def test_weighted_fcf_and_roic_skip_nulls():
    lt = look_through([(0.3, {"fcf_yield": 0.02, "roic": 0.10}), (0.1, {"fcf_yield": 0.06, "roic": None}),
                       (0.1, {"fcf_yield": float("nan"), "roic": 0.30})])
    assert lt["weighted_fcf_yield"] == pytest.approx((0.3 * 0.02 + 0.1 * 0.06) / 0.4)   # 0.03
    assert lt["weighted_roic"] == pytest.approx((0.3 * 0.10 + 0.1 * 0.30) / 0.4)        # 0.15
    assert lt["coverage_pct"] == pytest.approx(0.5)


def test_look_through_empty():
    assert look_through([]) == {"weighted_pe": None, "weighted_fcf_yield": None,
                                "weighted_roic": None, "coverage_pct": 0.0}
    assert look_through([(0.0, {"pe": 10}), (float("nan"), {"pe": 5})])["weighted_pe"] is None


# ------------------------------------------------------------------ fund record / build

def test_fund_record_from_real_shape():
    rec = fund_record(FUND_BY_TICKER["VOO"], parse_nport(REAL_SHAPE), COMPANIES,
                      expense_ratio=0.0003, is_sample=False, sources=[])
    assert rec["holdings_count"] == 5
    assert rec["top_holdings"][0] == {"name": "Apple Inc", "ticker": "AAPL", "weight": 0.4, "mapped": True}
    assert rec["top_holdings"][1]["ticker"] == "XOM"
    # AAPL 0.4 @ E/P 5%, XOM 0.3 @ E/P 10% → E/P (0.02+0.03)/0.7 = 7.142857% → P/E 14.0
    assert rec["look_through"]["weighted_pe"] == pytest.approx(14.0)
    assert rec["look_through"]["weighted_roic"] == pytest.approx(0.60)       # XOM roic null
    assert rec["look_through"]["coverage_pct"] == pytest.approx(0.70)
    assert rec["sector_weights"] == {"Technology": 0.4, "Energy": 0.3}
    assert rec["allocation"]["bond"] == pytest.approx(0.2)


def test_fund_record_null_safety():
    rec = fund_record(FUND_BY_TICKER["GLD"], NportFiling(), [], expense_ratio=None, is_sample=True, sources=[])
    assert rec["allocation"] is None and rec["top_holdings"] == [] and rec["expense_ratio"] is None
    assert rec["look_through"]["weighted_pe"] is None
    json.dumps(rec, allow_nan=False)


def test_offline_build_writes_contract_shape(tmp_path: Path):
    out = tmp_path / "funds.json"
    doc = build(offline=True, out=out, log=lambda *a, **k: None)
    on_disk = json.loads(out.read_text())
    assert on_disk["schema_version"] == 1 and on_disk["source"] == "fixture"
    tickers = [f["ticker"] for f in doc["funds"]]
    assert tickers == ["VOO", "VTI", "QQQ", "SCHD", "XLV", "XLE", "GLD", "HACK"]
    keys = {"ticker", "name", "issuer", "category", "expense_ratio", "total_net_assets", "as_of",
            "holdings_count", "top_holdings", "allocation", "sector_weights", "look_through",
            "is_sample", "sources"}
    for f in doc["funds"]:
        assert keys <= set(f)
        assert f["is_sample"] is True
        assert sum(f["allocation"].values()) == pytest.approx(1.0, abs=1e-4)
        assert all(not h["name"].startswith(AGGREGATE_PREFIX) for h in f["top_holdings"])
        assert set(f["look_through"]) == {"weighted_pe", "weighted_fcf_yield", "weighted_roic", "coverage_pct"}
        ws = [h["weight"] for h in f["top_holdings"]]
        assert ws == sorted(ws, reverse=True)
    by = {f["ticker"]: f for f in doc["funds"]}
    assert by["VOO"]["expense_ratio"] == pytest.approx(0.0003)
    assert by["VOO"]["sources"][1]["type"] == "prospectus-ixbrl"
    assert by["VOO"]["top_holdings"][0]["ticker"] == "NVDA"
    assert by["GLD"]["allocation"]["commodity"] == pytest.approx(1.0)
    assert by["GLD"]["look_through"]["weighted_pe"] is None
    # SCHD fixture has no identifiers for KO: the name heuristic maps it
    assert any(h["ticker"] == "KO" and h["mapped"] for h in by["SCHD"]["top_holdings"])
    # VTI fixture only has ISINs for our companies: CUSIP mapping
    assert by["VTI"]["top_holdings"][2]["ticker"] == "AAPL"
    # sector fund: unclassified remainder goes to its own sector
    assert "Unclassified" not in by["XLV"]["sector_weights"]


def test_live_failure_falls_back_to_fixture(tmp_path: Path):
    class Boom:
        def fund_ids(self, t):
            raise RuntimeError("HTTP 403 (proxy block?)")
    msgs = []
    doc = build(offline=False, tickers=["VOO"], out=tmp_path / "f.json", client=Boom(),
                log=lambda *a, **k: msgs.append(a[0]))
    assert doc["funds"][0]["is_sample"] is True and "falls back" not in msgs[0]
    assert "using sample fixture" in msgs[0]


def test_live_path_with_fake_client(tmp_path: Path):
    filing = parse_nport(REAL_SHAPE)

    class Fake:
        def fund_ids(self, t):
            return {"cik": 123456, "series_id": "S000009999", "class_id": "C000092055"}

        def latest_nport(self, cik, sid):
            return filing, "https://www.sec.gov/Archives/edgar/data/123456/0001/primary_doc.xml"

        def latest_prospectus(self, cik):
            return render_rr("vif", "C000092055", "0.03"), "https://www.sec.gov/x.htm"

    doc = build(offline=False, tickers=["VOO", "GLD"], out=tmp_path / "f.json", client=Fake(),
                companies_path=tmp_path / "missing.json", log=lambda *a, **k: None)
    voo, gld = doc["funds"]
    assert voo["is_sample"] is False and voo["expense_ratio"] == pytest.approx(0.0003)
    assert voo["sources"][0]["type"] == "nport-p"
    assert gld["is_sample"] is True          # grantor trust: no N-PORT, sample kept
    assert doc["source"] == "mixed"


def test_meta_present():
    meta = load_fixture_meta()
    assert meta["funds"]["VOO"]["holdings_count"] == 505
    assert not math.isnan(meta["funds"]["VTI"]["holdings_count"])
