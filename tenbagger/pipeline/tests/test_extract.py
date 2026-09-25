from pipeline.extract import (_total_debt, annual_series, dedupe_latest, extract_annuals,
                              fill_imputations, fiscal_year_of, is_annual, resolve_field)
from pipeline.sec import SecClient
from pipeline.tests.helpers import doc, fact

REV_TAGS = ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"]


# ---------------------------------------------------------------- fiscal year mapping
def test_fiscal_year_of_end_date():
    assert fiscal_year_of("2025-08-28") == 2025
    assert fiscal_year_of("2025-01-26") == 2025          # NVIDIA FY2025 ends late January
    assert fiscal_year_of("2021-01-03") == 2020          # J&J 53-week FY2020 spills into Jan
    assert fiscal_year_of("2023-12-31") == 2023


# ---------------------------------------------------------------- annual fact selection
def test_is_annual_accepts_only_fy_10k_full_year():
    assert is_annual(fact(1, "2024-12-31", "2024-01-01"), "flow")
    assert is_annual(fact(1, "2024-12-31", "2024-01-01", form="10-K/A"), "flow")
    assert not is_annual(fact(1, "2024-12-31", "2024-01-01", form="10-Q"), "flow")
    assert not is_annual(fact(1, "2024-12-31", "2024-01-01", fp="Q4"), "flow")
    assert not is_annual(fact(1, "2024-12-31", "2024-10-01"), "flow")      # 3-month Q4 inside a 10-K
    assert not is_annual(fact(1, "2024-09-30", "2024-01-01"), "flow")      # 9-month YTD
    assert is_annual(fact(1, "2023-09-03", "2022-08-29"), "flow")          # 53-week year (371 days)
    assert not is_annual(fact(1, "2024-12-31"), "flow")                    # flow needs a start
    assert is_annual(fact(1, "2024-12-31"), "instant")
    assert not is_annual(fact(1, "2024-12-31", "2024-01-01"), "instant")
    assert not is_annual({"end": "2024-12-31", "fp": "FY", "form": "10-K", "val": None}, "instant")


def test_period_year_comes_from_end_date_not_filing_fy():
    # A FY2025 10-K carries FY2024 and FY2023 comparatives, all tagged fy=2025.
    rows = [fact(300, "2025-12-31", "2025-01-01", fy=2025, filed="2026-02-01"),
            fact(200, "2024-12-31", "2024-01-01", fy=2025, filed="2026-02-01"),
            fact(100, "2023-12-31", "2023-01-01", fy=2025, filed="2026-02-01")]
    s = annual_series(doc({"Revenues": rows}), "Revenues", "USD", "flow")
    assert {fy: e["val"] for fy, e in s.items()} == {2023: 100, 2024: 200, 2025: 300}


def test_quarterly_and_partial_periods_are_ignored():
    rows = [fact(400, "2024-12-31", "2024-01-01"),
            fact(120, "2024-12-31", "2024-10-01"),                                  # Q4 in 10-K
            fact(90, "2025-03-31", "2025-01-01", fy=2025, fp="Q1", form="10-Q")]    # next-year 10-Q
    s = annual_series(doc({"Revenues": rows}), "Revenues", "USD", "flow")
    assert list(s) == [2024] and s[2024]["val"] == 400


# ---------------------------------------------------------------- restatements
def test_restatement_dedupe_latest_filed_wins():
    original = fact(94943, "2023-01-01", "2022-01-03", fy=2022, filed="2023-02-16")
    restated = fact(79990, "2023-01-01", "2022-01-03", fy=2023, filed="2024-02-16")
    assert dedupe_latest([restated, original]) == [restated]
    assert dedupe_latest([original, restated]) == [restated]
    s = annual_series(doc({"Revenues": [original, restated]}), "Revenues", "USD", "flow")
    assert s[2022]["val"] == 79990


def test_amendment_wins_tie_on_same_filed_date():
    k = fact(10, "2024-12-31", "2024-01-01", filed="2025-03-01")
    ka = fact(11, "2024-12-31", "2024-01-01", form="10-K/A", filed="2025-03-01")
    assert dedupe_latest([ka, k])[0]["val"] == 11


def test_jnj_fixture_restated_revenue_used():
    ann = extract_annuals(SecClient(offline=True).companyfacts(200406))
    assert ann["years"][2022]["revenue"] == 79_990_000_000   # Kenvue re-presentation, not 94,943
    assert ann["years"][2020]["revenue"] == 82_584_000_000   # FY2020 ended 2021-01-03
    assert ann["fy_end"][2020] == "2021-01-03"


# ---------------------------------------------------------------- tag fallback
def test_tag_fallback_order_and_per_year_switch():
    d = doc({
        "SalesRevenueNet": [fact(10, "2017-12-31", "2017-01-01"), fact(20, "2018-12-31", "2018-01-01")],
        "RevenueFromContractWithCustomerExcludingAssessedTax": [
            fact(21, "2018-12-31", "2018-01-01", filed="2020-02-01"), fact(30, "2019-12-31", "2019-01-01")],
    })
    got = resolve_field(d, REV_TAGS, "USD", "flow")
    assert {fy: (v, t) for fy, (v, t, _) in got.items()} == {
        2017: (10, "SalesRevenueNet"),
        2018: (21, "RevenueFromContractWithCustomerExcludingAssessedTax"),  # earlier tag in list wins
        2019: (30, "RevenueFromContractWithCustomerExcludingAssessedTax"),
    }


def test_first_listed_tag_preferred_when_all_present():
    d = doc({"Revenues": [fact(1, "2024-12-31", "2024-01-01")],
             "SalesRevenueNet": [fact(2, "2024-12-31", "2024-01-01")]})
    assert resolve_field(d, REV_TAGS, "USD", "flow")[2024][1] == "Revenues"


def test_mu_fixture_uses_pre_asc606_tag_for_old_years_and_ignores_10q():
    ann = extract_annuals(SecClient(offline=True).companyfacts(723125))
    assert ann["tags"][2016]["revenue"] == "SalesRevenueNet"
    assert ann["tags"][2025]["revenue"] == "RevenueFromContractWithCustomerExcludingAssessedTax"
    assert max(ann["years"]) == 2025                        # FY2026 10-Q facts ignored
    assert ann["years"][2025]["revenue"] == 37_378_000_000  # not the 3-month Q4 fact


# ---------------------------------------------------------------- composites
def test_instants_off_fiscal_year_end_are_dropped():
    d = doc({"Revenues": [fact(5, "2024-06-30", "2023-07-01")],
             "StockholdersEquity": [fact(50, "2024-06-30"), fact(40, "2024-03-31")]})
    ann = extract_annuals(d)
    assert ann["years"][2024]["total_equity"] == 50


def test_total_debt_variants():
    assert _total_debt({"lt_debt_noncurrent": 100, "lt_debt_current": 10, "short_term_debt": 5}) == 115
    assert _total_debt({"lt_debt_noncurrent": 100, "debt_current": 30, "lt_debt_current": 10}) == 130
    assert _total_debt({"lt_debt_total": 110, "lt_debt_current": 10, "debt_current": 25}) == 125
    assert _total_debt({"lt_debt_total": 110, "short_term_debt": 7}) == 117
    assert _total_debt({}) is None


def test_derived_gross_profit_capex_sign_and_fcf():
    d = doc({"Revenues": [fact(100, "2024-12-31", "2024-01-01")],
             "CostOfRevenue": [fact(60, "2024-12-31", "2024-01-01")],
             "NetCashProvidedByUsedInOperatingActivities": [fact(30, "2024-12-31", "2024-01-01")],
             "PaymentsToAcquireProductiveAssets": [fact(-12, "2024-12-31", "2024-01-01")],
             "LongTermDebtNoncurrent": [fact(40, "2024-12-31")],
             "LongTermDebtCurrent": [fact(5, "2024-12-31")]})
    y = extract_annuals(d)["years"][2024]
    assert y["gross_profit"] == 40 and y["capex"] == 12 and y["free_cash_flow"] == 18
    assert y["total_debt"] == 45


def test_fill_imputations():
    f = {"operating_cash_flow": 1, "total_assets": 5, "dividends_paid": None, "total_debt": None}
    notes = fill_imputations(f)
    assert f["dividends_paid"] == 0 and f["total_debt"] == 0 and len(notes) == 2
    g = {"operating_cash_flow": None, "total_assets": None, "dividends_paid": None, "total_debt": None}
    assert fill_imputations(g) == [] and g["dividends_paid"] is None
