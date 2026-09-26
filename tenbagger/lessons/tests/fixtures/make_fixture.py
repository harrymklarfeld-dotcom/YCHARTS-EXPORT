"""Build tests/fixtures/companies.json: a small, contract-conforming fixture.

Numbers are rounded approximations of public filings, for testing only
(`source: "fixture"`, `price_is_sample: true`). Metrics are derived with the exact
CONTRACT.md formulas so the fixture is internally consistent.

    python tests/fixtures/make_fixture.py
"""
from __future__ import annotations

import json
from pathlib import Path

B = 1e9

# fundamentals in $B (shares in billions), eps & price in $
RAW = [
    dict(ticker="AAPL", cik=320193, name="Apple Inc.", sector="Technology", industry="Consumer Electronics",
         fiscal_year_end="09-27", price=255.0, latest_fy=2025,
         f=dict(revenue=416.2, cost_of_revenue=221.0, operating_income=133.0, net_income=112.0, eps_diluted=7.46,
                shares_diluted=15.0, operating_cash_flow=111.5, capex=12.7, dividends_paid=15.4, cash=35.9,
                total_assets=359.2, total_liabilities=285.5, total_debt=98.7, current_assets=147.9,
                current_liabilities=165.6, inventory=5.7, d_and_a=11.7, income_tax=20.7, pretax_income=132.7),
         h=dict(fy=[2020, 2021, 2022, 2023, 2024], revenue=[274.5, 365.8, 394.3, 383.3, 391.0],
                net_income=[57.4, 94.7, 99.8, 97.0, 93.7], free_cash_flow=[73.4, 93.0, 111.4, 99.6, 108.8],
                eps_diluted=[3.28, 5.61, 6.11, 6.13, 6.08], gross_margin=[.382, .418, .433, .441, .462],
                operating_margin=[.241, .298, .303, .298, .315], total_debt=[112.4, 124.7, 120.1, 111.1, 106.6],
                cash=[38.0, 34.9, 23.6, 30.0, 29.9])),
    dict(ticker="MSFT", cik=789019, name="Microsoft Corporation", sector="Technology", industry="Software",
         fiscal_year_end="06-30", price=510.0, latest_fy=2025,
         f=dict(revenue=281.7, cost_of_revenue=87.8, operating_income=128.5, net_income=101.8, eps_diluted=13.64,
                shares_diluted=7.465, operating_cash_flow=136.2, capex=64.6, dividends_paid=24.1, cash=94.6,
                total_assets=619.0, total_liabilities=275.5, total_debt=43.2, current_assets=191.1,
                current_liabilities=141.2, inventory=0.9, d_and_a=34.2, income_tax=21.8, pretax_income=123.6),
         h=dict(fy=[2020, 2021, 2022, 2023, 2024], revenue=[143.0, 168.1, 198.3, 211.9, 245.1],
                net_income=[44.3, 61.3, 72.7, 72.4, 88.1], free_cash_flow=[45.2, 56.1, 65.1, 59.5, 74.1],
                eps_diluted=[5.76, 8.05, 9.65, 9.68, 11.80], gross_margin=[.679, .689, .684, .694, .698],
                operating_margin=[.371, .416, .421, .416, .446], total_debt=[70.0, 58.1, 49.8, 47.2, 44.9],
                cash=[136.5, 130.3, 104.8, 111.3, 75.5])),
    dict(ticker="COST", cik=909832, name="Costco Wholesale Corporation", sector="Consumer Staples",
         industry="Discount Stores", fiscal_year_end="08-31", price=930.0, latest_fy=2025,
         f=dict(revenue=275.2, cost_of_revenue=239.9, operating_income=10.4, net_income=8.1, eps_diluted=18.21,
                shares_diluted=0.4449, operating_cash_flow=13.3, capex=5.5, dividends_paid=2.3, cash=14.2,
                total_assets=77.1, total_liabilities=47.9, total_debt=5.8, current_assets=38.4,
                current_liabilities=37.1, inventory=18.1, d_and_a=2.4, income_tax=2.8, pretax_income=10.9),
         h=dict(fy=[2020, 2021, 2022, 2023, 2024], revenue=[166.8, 196.0, 227.0, 242.3, 254.5],
                net_income=[4.0, 5.0, 5.8, 6.3, 7.4], free_cash_flow=[5.4, 5.4, 3.5, 6.7, 7.4],
                eps_diluted=[9.02, 11.27, 13.14, 14.16, 16.56], gross_margin=[.130, .125, .121, .123, .126],
                operating_margin=[.033, .034, .034, .034, .035], total_debt=[7.5, 7.5, 6.6, 6.5, 5.9],
                cash=[12.3, 11.3, 10.2, 13.7, 9.9])),
    dict(ticker="KO", cik=21344, name="The Coca-Cola Company", sector="Consumer Staples", industry="Beverages",
         fiscal_year_end="12-31", price=70.0, latest_fy=2024,
         f=dict(revenue=47.1, cost_of_revenue=18.3, operating_income=10.0, net_income=10.6, eps_diluted=2.46,
                shares_diluted=4.32, operating_cash_flow=6.8, capex=2.1, dividends_paid=8.4, cash=10.8,
                total_assets=100.5, total_liabilities=74.2, total_debt=44.4, current_assets=25.2,
                current_liabilities=24.0, inventory=4.7, d_and_a=1.1, income_tax=2.4, pretax_income=13.1),
         h=dict(fy=[2020, 2021, 2022, 2023], revenue=[33.0, 38.7, 43.0, 45.8],
                net_income=[7.7, 9.8, 9.5, 10.7], free_cash_flow=[8.7, 11.3, 9.5, 9.7],
                eps_diluted=[1.79, 2.25, 2.19, 2.47], gross_margin=[.593, .603, .581, .595],
                operating_margin=[.273, .288, .250, .295], total_debt=[42.8, 42.8, 39.1, 42.1],
                cash=[6.8, 9.7, 9.5, 9.4])),
    dict(ticker="MU", cik=723125, name="Micron Technology, Inc.", sector="Technology", industry="Semiconductors",
         fiscal_year_end="08-28", price=160.0, latest_fy=2025,
         f=dict(revenue=37.4, cost_of_revenue=22.5, operating_income=9.8, net_income=8.5, eps_diluted=7.59,
                shares_diluted=1.12, operating_cash_flow=17.5, capex=15.9, dividends_paid=0.52, cash=10.3,
                total_assets=82.8, total_liabilities=28.5, total_debt=14.6, current_assets=28.8,
                current_liabilities=11.0, inventory=8.4, d_and_a=8.3, income_tax=1.1, pretax_income=9.6),
         h=dict(fy=list(range(2016, 2025)),
                revenue=[12.4, 20.3, 30.4, 23.4, 21.4, 27.7, 30.8, 15.5, 25.1],
                net_income=[-0.28, 5.1, 14.1, 6.3, 2.7, 5.9, 8.7, -5.8, 0.78],
                free_cash_flow=[-2.6, 5.0, 8.6, 3.6, 0.4, 3.7, 3.2, -6.1, 0.1],
                eps_diluted=[-0.27, 4.41, 11.51, 5.51, 2.37, 5.14, 7.75, -5.34, 0.70],
                gross_margin=[.20, .42, .59, .46, .31, .38, .45, -.09, .22],
                operating_margin=[.01, .35, .49, .30, .13, .23, .31, -.37, .06],
                total_debt=[10.0, 11.3, 5.0, 5.2, 6.4, 7.0, 6.9, 13.3, 14.0],
                cash=[4.1, 5.1, 6.5, 7.2, 7.6, 7.8, 8.3, 8.6, 7.0])),
    dict(ticker="NVDA", cik=1045810, name="NVIDIA Corporation", sector="Technology", industry="Semiconductors",
         fiscal_year_end="01-26", price=175.0, latest_fy=2025,
         f=dict(revenue=130.5, cost_of_revenue=32.6, operating_income=81.5, net_income=72.9, eps_diluted=2.94,
                shares_diluted=24.8, operating_cash_flow=64.1, capex=3.2, dividends_paid=0.83, cash=43.2,
                total_assets=111.6, total_liabilities=32.3, total_debt=8.5, current_assets=80.1,
                current_liabilities=18.0, inventory=10.1, d_and_a=1.9, income_tax=11.1, pretax_income=84.0),
         h=dict(fy=[2021, 2022, 2023, 2024], revenue=[16.7, 26.9, 27.0, 60.9],
                net_income=[4.3, 9.8, 4.4, 29.8], free_cash_flow=[4.7, 8.1, 3.8, 27.0],
                eps_diluted=[0.17, 0.39, 0.17, 1.19], gross_margin=[.624, .649, .569, .727],
                operating_margin=[.274, .372, .157, .541], total_debt=[7.0, 11.0, 11.0, 9.7],
                cash=[11.6, 21.2, 13.3, 26.0])),
    dict(ticker="INTC", cik=50863, name="Intel Corporation", sector="Technology", industry="Semiconductors",
         fiscal_year_end="12-28", price=24.0, latest_fy=2024,
         f=dict(revenue=53.1, cost_of_revenue=35.8, operating_income=-11.7, net_income=-18.8, eps_diluted=-4.38,
                shares_diluted=4.28, operating_cash_flow=8.3, capex=23.9, dividends_paid=1.6, cash=22.1,
                total_assets=196.5, total_liabilities=91.5, total_debt=50.0, current_assets=47.3,
                current_liabilities=35.7, inventory=12.2, d_and_a=11.4, income_tax=8.0, pretax_income=-11.2),
         h=dict(fy=[2020, 2021, 2022, 2023], revenue=[77.9, 79.0, 63.1, 54.2],
                net_income=[20.9, 19.9, 8.0, 1.7], free_cash_flow=[21.1, 11.3, -9.6, -14.3],
                eps_diluted=[4.94, 4.86, 1.94, 0.40], gross_margin=[.564, .553, .426, .400],
                operating_margin=[.306, .247, .037, .001], total_debt=[36.4, 38.1, 42.1, 49.3],
                cash=[23.9, 28.4, 28.3, 25.0])),
    dict(ticker="WMT", cik=104169, name="Walmart Inc.", sector="Consumer Staples", industry="Discount Stores",
         fiscal_year_end="01-31", price=95.0, latest_fy=2025,
         f=dict(revenue=681.0, cost_of_revenue=511.8, operating_income=29.3, net_income=19.4, eps_diluted=2.41,
                shares_diluted=8.06, operating_cash_flow=36.4, capex=23.8, dividends_paid=6.7, cash=9.0,
                total_assets=260.8, total_liabilities=163.1, total_debt=39.0, current_assets=79.5,
                current_liabilities=96.6, inventory=56.4, d_and_a=12.9, income_tax=6.2, pretax_income=26.3),
         h=dict(fy=[2021, 2022, 2023, 2024], revenue=[559.2, 572.8, 611.3, 648.1],
                net_income=[13.5, 13.7, 11.7, 15.5], free_cash_flow=[25.8, 11.1, 12.0, 15.1],
                eps_diluted=[1.58, 1.62, 1.42, 1.91], gross_margin=[.249, .251, .239, .241],
                operating_margin=[.041, .045, .034, .042], total_debt=[45.0, 41.0, 43.0, 40.0],
                cash=[17.7, 14.8, 8.6, 9.9])),
]

PER_SHARE = {"eps_diluted"}
RATIO_HIST = {"gross_margin", "operating_margin"}


def build_company(r: dict) -> dict:
    f = {k: (v if k in PER_SHARE else round(v * B)) for k, v in r["f"].items()}
    f["gross_profit"] = f["revenue"] - f["cost_of_revenue"]
    f["free_cash_flow"] = f["operating_cash_flow"] - f["capex"]
    f["total_equity"] = f["total_assets"] - f["total_liabilities"]
    price, fy = r["price"], r["latest_fy"]

    hist = {}
    for key, vals in r["h"].items():
        if key == "fy":
            continue
        scale = 1 if key in PER_SHARE | RATIO_HIST else B
        rows = [[y, (v if scale == 1 else round(v * scale))] for y, v in zip(r["h"]["fy"], vals)]
        latest = {"gross_margin": f["gross_profit"] / f["revenue"],
                  "operating_margin": f["operating_income"] / f["revenue"]}.get(key, f.get(key))
        rows.append([fy, latest])
        hist[key] = rows

    mc = price * f["shares_diluted"]
    ev = mc + f["total_debt"] - f["cash"]
    ebitda = f["operating_income"] + f["d_and_a"]
    eq = f["total_equity"]
    tr = f["income_tax"] / f["pretax_income"] if f["pretax_income"] > 0 else 0.21
    tr = min(max(tr, 0.0), 0.35)
    ic = f["total_debt"] + eq - f["cash"]
    rev_h = dict((y, v) for y, v in hist["revenue"])
    eps_h = dict((y, v) for y, v in hist["eps_diluted"])

    def ratio(a, b):
        return a / b if b else None

    m = {
        "market_cap": mc, "enterprise_value": ev,
        "pe": price / f["eps_diluted"] if f["eps_diluted"] > 0 else None,
        "ps": mc / f["revenue"],
        "pb": mc / eq if eq > 0 else None,
        "ev_ebitda": ev / ebitda if ebitda > 0 else None,
        "fcf_yield": f["free_cash_flow"] / mc,
        "earnings_yield": f["eps_diluted"] / price,
        "dividend_yield": f["dividends_paid"] / mc,
        "gross_margin": f["gross_profit"] / f["revenue"],
        "operating_margin": f["operating_income"] / f["revenue"],
        "net_margin": f["net_income"] / f["revenue"],
        "fcf_margin": f["free_cash_flow"] / f["revenue"],
        "roe": ratio(f["net_income"], eq), "roa": f["net_income"] / f["total_assets"],
        "roic": f["operating_income"] * (1 - tr) / ic if ic > 0 else None,
        "debt_to_equity": ratio(f["total_debt"], eq),
        "current_ratio": f["current_assets"] / f["current_liabilities"],
        "net_cash": f["cash"] - f["total_debt"],
        "revenue_growth_yoy": rev_h[fy] / rev_h[fy - 1] - 1 if rev_h.get(fy - 1) else None,
        "eps_growth_yoy": eps_h[fy] / eps_h[fy - 1] - 1 if (eps_h.get(fy - 1) or 0) > 0 else None,
        "revenue_cagr_3y": (rev_h[fy] / rev_h[fy - 3]) ** (1 / 3) - 1 if rev_h.get(fy - 3) else None,
    }
    return {
        "ticker": r["ticker"], "cik": r["cik"], "name": r["name"], "sector": r["sector"],
        "industry": r["industry"], "fiscal_year_end": r["fiscal_year_end"], "price": price,
        "price_date": "2026-09-08", "price_is_sample": True, "latest_fy": fy,
        "fundamentals": f, "metrics": m, "history": hist,
    }


def main() -> None:
    doc = {"schema_version": 1, "generated_at": "2026-09-25T00:00:00Z", "source": "fixture",
           "companies": [build_company(r) for r in RAW]}
    out = Path(__file__).with_name("companies.json")
    out.write_text(json.dumps(doc, indent=1) + "\n")
    print(f"wrote {out} ({len(doc['companies'])} companies)")


if __name__ == "__main__":
    main()
