import io
import json
import time

import pytest

from pipeline import cli, sec
from pipeline.build import build_dataset, write_dataset
from pipeline.metrics import METRIC_FIELDS
from pipeline.schema import HISTORY_FIELDS, validate_document
from pipeline.sec import RateLimiter, SecClient, SecError
from pipeline.tags import FUNDAMENTAL_FIELDS

FIXTURE_TICKERS = ["MU", "AAPL", "MSFT", "COST", "KO", "NVDA", "JPM", "XOM", "JNJ", "TSLA", "AMZN", "PG"]


@pytest.fixture(scope="module")
def dataset():
    return build_dataset(FIXTURE_TICKERS, offline=True)


def test_all_fixtures_build_and_match_schema(dataset):
    assert dataset["schema_version"] == 1 and dataset["source"] == "fixture"
    assert [c["ticker"] for c in dataset["companies"]] == FIXTURE_TICKERS
    assert validate_document(dataset) == []
    json.dumps(dataset, allow_nan=False)  # strict JSON: no NaN / Infinity


def test_company_shape(dataset):
    for c in dataset["companies"]:
        assert set(c["fundamentals"]) == set(FUNDAMENTAL_FIELDS)
        assert set(c["metrics"]) == set(METRIC_FIELDS)
        assert set(c["history"]) == set(HISTORY_FIELDS)
        assert len(c["fiscal_year_end"]) == 5 and c["fiscal_year_end"][2] == "-"
        for series in c["history"].values():
            fys = [p[0] for p in series]
            assert fys == sorted(fys) and len(fys) <= 10
            assert all(fy <= c["latest_fy"] for fy in fys)


def test_mu_record(dataset):
    mu = next(c for c in dataset["companies"] if c["ticker"] == "MU")
    assert mu["cik"] == 723125 and mu["latest_fy"] == 2025 and mu["fiscal_year_end"] == "08-28"
    f = mu["fundamentals"]
    assert f["revenue"] == 37_378_000_000 and f["capex"] == 15_857_000_000
    assert f["free_cash_flow"] == f["operating_cash_flow"] - f["capex"]
    assert [p[0] for p in mu["history"]["revenue"]] == list(range(2016, 2026))  # 10 of 11 years
    assert mu["price_is_sample"] is True
    assert mu["metrics"]["market_cap"] == round(mu["price"] * f["shares_diluted"])


def test_bank_and_no_dividend_nulls(dataset):
    jpm = next(c for c in dataset["companies"] if c["ticker"] == "JPM")
    assert jpm["metrics"]["gross_margin"] is None and jpm["metrics"]["current_ratio"] is None
    tsla = next(c for c in dataset["companies"] if c["ticker"] == "TSLA")
    assert tsla["fundamentals"]["dividends_paid"] == 0 and tsla["metrics"]["dividend_yield"] == 0
    assert any("dividends_paid" in n for n in tsla["data_notes"])


def test_user_prices_override_sample(tmp_path):
    p = tmp_path / "prices.csv"
    p.write_text("ticker,price,price_date\nMU,120.5,2026-09-24\n")
    doc = build_dataset(["MU", "KO"], offline=True, prices_path=str(p))
    mu, ko = doc["companies"]
    assert mu["price"] == 120.5 and mu["price_is_sample"] is False and mu["price_date"] == "2026-09-24"
    assert ko["price_is_sample"] is True  # fell back to the sample fixture


def test_missing_price_gives_null_market_metrics(monkeypatch):
    monkeypatch.setattr("pipeline.build.load_prices", lambda path: {})
    c = build_dataset(["KO"], offline=True)["companies"][0]
    assert c["price"] is None and c["metrics"]["pe"] is None and c["metrics"]["gross_margin"] is not None
    assert validate_document(build_dataset(["KO"], offline=True)) == []


def test_unknown_ticker_skipped(capsys):
    doc = build_dataset(["ZZZZ", "KO"], offline=True)
    assert [c["ticker"] for c in doc["companies"]] == ["KO"]
    assert "ZZZZ" in capsys.readouterr().err


def test_schema_validator_catches_problems(dataset):
    bad = json.loads(json.dumps(dataset))
    c = bad["companies"][0]
    c["metrics"]["pe"] = float("nan")
    del c["fundamentals"]["cash"]
    c["history"]["revenue"] = list(reversed(c["history"]["revenue"]))
    bad["schema_version"] = 2
    errs = "\n".join(validate_document(bad))
    for needle in ("schema_version", "pe not a finite", "fundamentals keys mismatch", "ascending"):
        assert needle in errs


def test_write_refuses_invalid(tmp_path, dataset):
    bad = dict(dataset, source="nope")
    with pytest.raises(ValueError):
        write_dataset(bad, tmp_path / "x.json")
    out = write_dataset(dataset, tmp_path / "ok.json")
    assert json.loads(out.read_text())["schema_version"] == 1


def test_cli_build_offline(tmp_path, capsys):
    out = tmp_path / "companies.json"
    rc = cli.main(["build", "--tickers", "MU,COST", "--offline", "--out", str(out)])
    assert rc == 0
    assert [c["ticker"] for c in json.loads(out.read_text())["companies"]] == ["MU", "COST"]


def test_cli_universe_offline_skips_missing_fixtures(tmp_path):
    out = tmp_path / "u.json"
    assert cli.main(["build", "--universe", "sp500-sample", "--offline", "--out", str(out)]) == 0
    assert len(json.loads(out.read_text())["companies"]) == 12


# ---------------------------------------------------------------- SEC client
def test_offline_missing_fixture_raises():
    with pytest.raises(SecError):
        SecClient(offline=True).companyfacts(999999999)


def test_offline_ticker_map():
    tm = SecClient(offline=True).ticker_map()
    assert tm["MU"]["cik"] == 723125


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def test_live_client_sends_user_agent_and_caches(tmp_path, monkeypatch):
    seen = []

    def fake_urlopen(req, timeout=None, context=None):
        seen.append((req.full_url, req.get_header("User-agent")))
        return _Resp(json.dumps({"cik": 723125, "facts": {}}).encode())

    monkeypatch.setattr(sec.urllib.request, "urlopen", fake_urlopen)
    c = SecClient(offline=False, user_agent="Tester t@example.com", cache_dir=tmp_path)
    assert c.companyfacts(723125)["cik"] == 723125
    assert c.companyfacts(723125)["cik"] == 723125  # served from disk cache
    assert seen == [("https://data.sec.gov/api/xbrl/companyfacts/CIK0000723125.json", "Tester t@example.com")]
    assert (tmp_path / "companyfacts" / "CIK0000723125.json").exists()


def test_user_agent_from_env(monkeypatch):
    monkeypatch.setenv("TENBAGGER_SEC_UA", "Env Name env@example.com")
    assert SecClient().user_agent == "Env Name env@example.com"


def test_live_403_raises_helpful_error(tmp_path, monkeypatch):
    def fake_urlopen(req, timeout=None, context=None):
        raise sec.urllib.error.HTTPError(req.full_url, 403, "Forbidden", {}, None)

    monkeypatch.setattr(sec.urllib.request, "urlopen", fake_urlopen)
    with pytest.raises(SecError, match="403"):
        SecClient(cache_dir=tmp_path).companyfacts(1)


def test_rate_limiter_spacing():
    rl = RateLimiter(per_second=50)
    t0 = time.monotonic()
    for _ in range(4):
        rl.wait()
    assert time.monotonic() - t0 >= 3 * 0.02 * 0.9
