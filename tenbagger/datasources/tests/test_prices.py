import pytest

from datasources.alpaca import AlpacaPriceSource
from datasources.base import MissingCredentials, PriceQuote, SourceError
from datasources.csv_prices import CsvPriceSource, write_prices_csv
from datasources.eodhd import EodhdPriceSource
from datasources.fmp import FmpPriceSource
from datasources.intrinio import IntrinioPriceSource

from .conftest import FIX


class FakeFetch:
    def __init__(self, payload):
        self.payload, self.urls, self.headers = payload, [], []

    def __call__(self, url, headers=None, **kw):
        self.urls.append(url)
        self.headers.append(headers or {})
        return self.payload(url) if callable(self.payload) else self.payload


def test_quote_validation():
    with pytest.raises(SourceError):
        PriceQuote("X", float("nan"), "2026-01-01", "t")
    with pytest.raises(SourceError):
        PriceQuote("X", 0, "2026-01-01", "t")
    assert PriceQuote(" mu ", 1, "2026-01-01T20:00:00Z", "t").price_date == "2026-01-01"


def test_csv_source_skips_bad_rows_and_defaults_not_displayable(tmp_path):
    src = CsvPriceSource(FIX / "prices_vendor.csv")
    q = src.latest_prices(["mu", "AAPL", "BAD", "NEG", "NOPE"])
    assert sorted(q) == ["AAPL", "MU"] and q["MU"].price == 101.5
    assert src.license_allows_display is False
    assert CsvPriceSource(FIX / "prices_vendor.csv", "Tiingo redistribution #42", True).license_allows_display
    out = write_prices_csv(q, tmp_path / "p.csv", comment="hello")
    assert out.read_text().splitlines()[:3] == ["# hello", "ticker,price,price_date,is_sample",
                                                "AAPL,250.25,2026-09-24,false"]


def test_alpaca(monkeypatch):
    with pytest.raises(MissingCredentials):
        AlpacaPriceSource().latest_prices(["MU"])
    f = FakeFetch({"bars": {"MU": {"t": "2026-09-24T04:00:00Z", "c": 101.5},
                            "BRK.B": {"t": "2026-09-24T04:00:00Z", "c": 480.0}}})
    src = AlpacaPriceSource("kid", "sec", fetch=f)
    q = src.latest_prices(["MU", "BRK-B"])
    assert q["MU"].price == 101.5 and q["BRK-B"].price == 480.0 and q["MU"].price_date == "2026-09-24"
    assert "feed=iex" in f.urls[0] and "BRK.B" in f.urls[0].replace("%2C", ",").replace("%2E", ".")
    assert f.headers[0]["APCA-API-KEY-ID"] == "kid"
    assert src.license_allows_display is False
    monkeypatch.setenv("TENBAGGER_ALPACA_DISPLAY_LICENSE", "1")      # a bare flag is not a contract
    assert src.license_allows_display is False
    monkeypatch.setenv("TENBAGGER_ALPACA_DISPLAY_LICENSE", "Broker API data addendum 2026-10")
    assert src.license_allows_display is True


def test_eodhd():
    f = FakeFetch([{"code": "MU", "date": "2026-09-24", "close": 101.5, "adjusted_close": 101.4},
                   {"code": "XXX", "date": "2026-09-24", "close": 1}])
    q = EodhdPriceSource("tok", fetch=f).latest_prices(["MU"])
    assert list(q) == ["MU"] and q["MU"].price == 101.5
    assert "api_token=tok" in f.urls[0] and "/eod-bulk-last-day/US" in f.urls[0]
    with pytest.raises(SourceError):
        EodhdPriceSource("tok", fetch=FakeFetch({"error": "x"})).latest_prices(["MU"])


def test_intrinio_skips_failures():
    def payload(url):
        if "/NOPE/" in url:
            raise SourceError("404")
        return {"stock_prices": [{"date": "2026-09-24", "close": 250.0}]}
    q = IntrinioPriceSource("k", fetch=FakeFetch(payload)).latest_prices(["AAPL", "NOPE"])
    assert list(q) == ["AAPL"]


def test_fmp():
    f = FakeFetch([{"symbol": "AAPL", "price": 250.0, "timestamp": 1790280000}])
    q = FmpPriceSource("k", fetch=f).latest_prices(["AAPL"])
    assert q["AAPL"].price == 250.0 and q["AAPL"].price_date.startswith("2026-")
    assert "/stable/batch-quote" in f.urls[0]
