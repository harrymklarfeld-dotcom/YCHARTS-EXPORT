import json

import pytest

from datasources.edgar_bulk import (EdgarBulkFundamentals, latest_published_quarter, quarter_ids,
                                    read_fsds, to_companyfacts, write_companyfacts_cache)
from datasources.base import SourceError
from datasources.edgar_bulk import download_quarters
from datetime import date


def test_read_filters_forms_segments_coreg_custom(fsds_zip):
    p = read_fsds(fsds_zip)
    assert set(s["cik"] for s in p["subs"].values()) == {723125}  # 10-Q filer dropped
    tags = {f["tag"] for f in p["facts"]}
    assert "MuCustomMetric" not in tags and "Liabilities" not in tags
    assets = [f for f in p["facts"] if f["tag"] == "Assets"]
    assert sorted(f["value"] for f in assets) == [69416000000.0, 82798000000.0]  # coreg row skipped
    rev = [f for f in p["facts"] if f["tag"].startswith("RevenueFromContract")]
    assert len(rev) == 3  # segment row skipped, Q4-only row kept (filtered later)


def test_companyfacts_shape(fsds_zip):
    doc = to_companyfacts([read_fsds(fsds_zip)])[723125]
    usd = doc["facts"]["us-gaap"]["RevenueFromContractWithCustomerExcludingAssessedTax"]["units"]["USD"]
    fy25 = [e for e in usd if e["end"] == "2025-08-31" and e["start"] == "2024-09-01"]
    assert fy25 and fy25[0]["val"] == 37378000000 and fy25[0]["form"] == "10-K" and fy25[0]["fp"] == "FY"
    assert fy25[0]["filed"] == "2025-10-03" and fy25[0]["accn"] == "0000723125-25-000028"
    eps = doc["facts"]["us-gaap"]["EarningsPerShareDiluted"]["units"]["USD/shares"][0]
    assert eps["val"] == 7.59 and isinstance(eps["val"], float)
    inst = doc["facts"]["us-gaap"]["Assets"]["units"]["USD"]
    assert all("start" not in e for e in inst)
    assert doc["facts"]["dei"]["EntityCommonStockSharesOutstanding"]["units"]["shares"][0]["val"] == 1119000000


def test_fundamentals_source(fsds_zip):
    src = EdgarBulkFundamentals([fsds_zip])
    assert src.license_allows_display is True
    assert src.sic(723125) == 3674
    fy = src.annual_fundamentals(723125)
    assert sorted(fy) == [2024, 2025]
    f = fy[2025]
    assert f["revenue"] == 37378000000          # annual, not the Q4-only or segment value
    assert f["gross_profit"] == 37378000000 - 22405000000
    assert f["free_cash_flow"] == 17525000000 - 15857000000
    assert f["total_assets"] == 82798000000
    assert fy[2024]["revenue"] == 25111000000
    assert src.annual_fundamentals(1) == {}


def test_cache_is_readable_by_pipeline(fsds_zip, tmp_path):
    res = write_companyfacts_cache([fsds_zip], tmp_path / "cache",
                                   {"MU": {"cik": 723125, "name": "Micron Technology"},
                                    "ZZZ": {"cik": 1, "name": "Missing"}})
    assert res["companies"] == 1 and res["missing"] == ["ZZZ"]
    tmap = json.loads((tmp_path / "cache" / "company_tickers.json").read_text())
    assert {"cik_str": 723125, "ticker": "MU", "title": "Micron Technology"} in tmap.values()
    assert json.loads((tmp_path / "cache" / "sic.json").read_text()) == {"723125": 3674}
    doc = json.loads((tmp_path / "cache" / "companyfacts" / "CIK0000723125.json").read_text())
    assert doc["entityName"] == "Micron Technology" and "_sic" not in doc

    extract = pytest.importorskip("pipeline.extract")  # owned by the pipeline agent
    ann = extract.extract_annuals(doc)
    assert ann["years"][2025]["revenue"] == 37378000000
    assert ann["years"][2025]["net_income"] == 8539000000


def test_quarters():
    assert quarter_ids("2026q2", 3) == ["2025q4", "2026q1", "2026q2"]
    assert latest_published_quarter(date(2026, 9, 25)) == "2026q2"
    assert latest_published_quarter(date(2026, 2, 1)) == "2025q4"


def test_download_requires_contact_ua(tmp_path):
    with pytest.raises(SourceError):
        download_quarters(["2025q4"], tmp_path, "no-email-here")
    calls = []

    def fake(url, headers=None, as_json=True):
        calls.append((url, headers))
        return b"PK"
    got = download_quarters(["2025q4"], tmp_path, "Tenbagger ops@example.com", fetch=fake)
    assert got[0].read_bytes() == b"PK"
    assert calls[0][0].endswith("/financial-statement-data-sets/2025q4.zip")
    assert calls[0][1]["User-Agent"] == "Tenbagger ops@example.com"
