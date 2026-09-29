import pytest

from pipeline.validate import compare

openpyxl = pytest.importorskip("openpyxl")


def test_compare_tolerances():
    ours = {2025: {"revenue": 100_500_000, "eps_diluted": 1.00, "net_income": 3_000_000, "capex": None}}
    ref = {2025: {"revenue": 100.0, "eps_diluted": 1.05, "net_income": 0.0, "capex": 5.0}}
    rows = {r["field"]: r for r in compare(ours, ref, ["revenue", "eps_diluted", "net_income", "capex"])}
    assert rows["revenue"]["status"] == "PASS"       # 0.5 % off
    assert rows["eps_diluted"]["status"] == "FAIL"   # $0.05 off
    assert rows["net_income"]["status"] == "PASS"    # within $5M absolute floor
    assert rows["capex"]["status"] == "n/a"


def test_mu_offline_matches_ycharts(capsys):
    from pipeline.validate import run
    assert run("MU", offline=True) == 0
    out = capsys.readouterr().out
    assert "0 fail" in out and "2025  revenue" in out
