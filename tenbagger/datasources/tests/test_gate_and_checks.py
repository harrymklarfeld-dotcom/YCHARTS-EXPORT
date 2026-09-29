import json

import pytest

from datasources.base import LicenseError, LicenseInfo, MissingCredentials, PriceQuote
from datasources.checks import load_strict, sanity_errors, validate_file
from datasources.cli import main
from datasources.enrich import enrich_sectors
from datasources.manifest import assert_publishable, build_manifest, check_publishable
from datasources.sic import sector_for_sic
from datasources.supabase import upsert_companies
from datasources import universe

from .conftest import FIX, TENBAGGER


def company(t, price=100.0, sample=False, mc=1e9, date="2026-09-24"):
    return {"ticker": t, "cik": 1, "price": price, "price_date": date, "price_is_sample": sample,
            "sector": "Unknown", "industry": "Unknown",
            "fundamentals": {"revenue": 10.0, "total_assets": 5.0, "shares_diluted": 1e7},
            "metrics": {"market_cap": mc, "gross_margin": 0.4}}


def test_gate_blocks_unlicensed_real_prices():
    doc = {"companies": [company("MU"), company("KO", sample=True), company("X", price=None)]}
    unlic = build_manifest({"MU": PriceQuote("MU", 100, "2026-09-24", "alpaca")},
                           [LicenseInfo("alpaca", False)])
    assert any("lacks a display" in p for p in check_publishable(doc, unlic))
    with pytest.raises(LicenseError):
        assert_publishable(doc, None)                      # real price, no provenance
    lic = build_manifest({"MU": PriceQuote("MU", 100, "2026-09-24", "eodhd")},
                         [LicenseInfo("eodhd", True, "B2B #1")])
    assert check_publishable(doc, lic) == []
    stale = {"companies": [company("MU", date="2026-09-01")]}
    assert any("does not match" in p for p in check_publishable(stale, lic))
    assert check_publishable({"companies": [company("KO", sample=True)]}, None) == []


def test_sanity():
    good = {"companies": [company("A"), company("B")]}
    assert sanity_errors(good, min_count=2) == []
    bad = {"companies": [company("A", mc=0), company("A", mc=float("nan"))]}
    errs = " | ".join(sanity_errors(bad, min_count=5, min_price_coverage=1.0))
    assert "threshold 5" in errs and "duplicate" in errs and "market_cap must be > 0" in errs
    assert "non-finite" in errs


def test_load_strict_rejects_nan(tmp_path):
    p = tmp_path / "c.json"
    p.write_text('{"schema_version": 1, "companies": [{"x": NaN}]}')
    with pytest.raises(ValueError):
        load_strict(p)
    assert validate_file(p)[0].startswith("cannot load")


def test_repo_companies_json_validates():
    p = TENBAGGER / "data" / "companies.json"
    if not p.exists():
        pytest.skip("no data/companies.json yet")
    assert validate_file(p, min_count=1) == []


def test_sic_and_enrich():
    assert sector_for_sic(3674) == "Technology" and sector_for_sic(2834) == "Health Care"
    assert sector_for_sic(6021) == "Financials" and sector_for_sic("x") is None
    doc = {"companies": [{"cik": 723125, "sector": "Unknown", "industry": "Unknown"},
                         {"cik": 2, "sector": "Energy", "industry": "Oil"}]}
    assert enrich_sectors(doc, {"723125": 3674, "2": 7372}) == 1
    assert doc["companies"][0] == {"cik": 723125, "sector": "Technology", "industry": "Semiconductors"}
    assert doc["companies"][1]["sector"] == "Energy"


def test_universe():
    u = universe.load("sp500")
    assert len(u) >= 490 and u["MU"]["cik"] == 723125 and "BRK-B" in u


def test_supabase_upsert():
    with pytest.raises(MissingCredentials):
        upsert_companies({})
    seen = {}

    def post(url, payload, headers):
        seen.update(url=url, payload=payload, headers=headers)
        return 3
    assert upsert_companies({"schema_version": 1}, "https://x.supabase.co/", "srk", post=post) == 3
    assert seen["url"] == "https://x.supabase.co/rest/v1/rpc/load_companies"
    assert seen["payload"] == {"doc": {"schema_version": 1}} and seen["headers"]["apikey"] == "srk"


def test_cli_prices_then_gate(tmp_path, capsys):
    out = tmp_path / "prices.csv"
    assert main(["prices", "--source", "csv", "--csv", str(FIX / "prices_vendor.csv"),
                 "--tickers", "MU,AAPL", "--out", str(out)]) == 0
    man = json.loads((tmp_path / "prices.csv.manifest.json").read_text())
    assert man["prices"]["MU"]["display_allowed"] is False
    comp = tmp_path / "companies.json"
    comp.write_text(json.dumps({"companies": [company("MU", price=101.5)]}))
    assert main(["gate", "--companies", str(comp), "--manifest", str(tmp_path / "prices.csv.manifest.json")]) == 3
    assert main(["prices", "--source", "csv", "--csv", str(FIX / "prices_vendor.csv"), "--csv-license-ref",
                 "Tiingo redistribution #42", "--tickers", "MU", "--out", str(out)]) == 0
    assert main(["gate", "--companies", str(comp), "--manifest", str(tmp_path / "prices.csv.manifest.json")]) == 0
    assert main(["prices", "--source", "eodhd", "--tickers", "MU", "--out", str(out)]) == 1  # no key
