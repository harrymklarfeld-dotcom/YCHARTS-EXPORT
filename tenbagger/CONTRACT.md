# Tenbagger — shared build contract

Working name: **Tenbagger**: Duolingo-style investing lessons built on real company
financials, a friendly screener, and (later) your own linked brokerage holdings.

Every agent builds against this file. Do not change a shape here without saying so
in your final report.

## Layout (each agent owns ONE directory, touches nothing else)

| Dir | Owner | Phase |
|---|---|---|
| `tenbagger/pipeline/` | data pipeline agent (Python 3.11, stdlib + small deps) | 0 |
| `tenbagger/lessons/` | lesson generator agent (Python) | 1 |
| `tenbagger/mobile/` | mobile app agent (Expo + TypeScript) | 1 & 2 UI |
| `tenbagger/packages/screener/` | screener engine agent (TypeScript, no deps) | 2 |
| `tenbagger/backend/` | accounts/brokerage agent (Supabase SQL + Deno edge functions) | 3 |
| `tenbagger/docs/` | research agent (markdown only) | pitch |
| `tenbagger/data/` | shared outputs; pipeline & lessons write, others read | — |

No agent runs `git commit` / `git push`. The lead integrates and commits.

## Network facts
- `data.sec.gov` / `www.sec.gov` are BLOCKED by this sandbox's proxy (403). Code must
  work against real EDGAR when network allows, but every test must run offline on fixtures.
- npm registry and PyPI are reachable.

## Money / unit conventions
- All currency values in **USD, raw units** (not millions). Shares in raw count.
- Ratios as **decimals** (0.447 = 44.7%). Multiples as plain numbers (P/E 18.2).
- `null` when not computable (e.g. negative earnings → P/E null). Never NaN/Infinity in JSON.
- Fiscal years as integer `fy` (the year the fiscal year ends in).

## `data/companies.json` (written by pipeline, read by lessons/mobile/screener)
```json
{
  "schema_version": 1,
  "generated_at": "2026-09-25T00:00:00Z",
  "source": "sec-edgar-xbrl | fixture",
  "companies": [
    {
      "ticker": "MU", "cik": 723125, "name": "Micron Technology, Inc.",
      "sector": "Technology", "industry": "Semiconductors",
      "fiscal_year_end": "08-28",
      "price": 100.0, "price_date": "2026-09-08", "price_is_sample": true,
      "latest_fy": 2025,
      "fundamentals": {            // latest fiscal year, raw USD
        "revenue": 0, "cost_of_revenue": 0, "gross_profit": 0,
        "operating_income": 0, "net_income": 0, "eps_diluted": 0,
        "shares_diluted": 0, "operating_cash_flow": 0, "capex": 0,
        "free_cash_flow": 0, "dividends_paid": 0,
        "cash": 0, "total_assets": 0, "total_liabilities": 0,
        "total_equity": 0, "total_debt": 0, "current_assets": 0,
        "current_liabilities": 0, "inventory": 0, "d_and_a": 0,
        "income_tax": 0, "pretax_income": 0
      },
      "metrics": {                 // derived; null if not computable
        "market_cap": 0, "enterprise_value": 0,
        "pe": 0, "ps": 0, "pb": 0, "ev_ebitda": 0,
        "fcf_yield": 0, "earnings_yield": 0, "dividend_yield": 0,
        "gross_margin": 0, "operating_margin": 0, "net_margin": 0, "fcf_margin": 0,
        "roe": 0, "roa": 0, "roic": 0,
        "debt_to_equity": 0, "current_ratio": 0, "net_cash": 0,
        "revenue_growth_yoy": 0, "eps_growth_yoy": 0, "revenue_cagr_3y": 0
      },
      "history": {                 // annual, ascending by fy, up to 10 years
        "revenue": [[2021, 0], [2022, 0]],
        "net_income": [], "free_cash_flow": [], "eps_diluted": [],
        "gross_margin": [], "operating_margin": [], "total_debt": [], "cash": []
      }
    }
  ]
}
```
Metric formulas (pipeline must implement exactly; lessons quote these in explanations):
- market_cap = price × shares_diluted; enterprise_value = market_cap + total_debt − cash
- pe = price / eps_diluted (null if eps ≤ 0); ps = market_cap / revenue; pb = market_cap / total_equity (null if equity ≤ 0)
- ev_ebitda = EV / (operating_income + d_and_a) (null if ≤ 0)
- fcf = operating_cash_flow − capex (capex positive number); fcf_yield = fcf / market_cap; earnings_yield = eps / price
- dividend_yield = dividends_paid / market_cap
- margins = x / revenue; roe = net_income / total_equity; roa = net_income / total_assets
- roic = operating_income × (1 − tax_rate) / (total_debt + total_equity − cash); tax_rate = income_tax / pretax_income clamped to [0, 0.35], default 0.21
- debt_to_equity = total_debt / total_equity; current_ratio = current_assets / current_liabilities; net_cash = cash − total_debt
- growth = this / prior − 1; revenue_cagr_3y = (rev_fy / rev_fy-3)^(1/3) − 1

## `data/lessons.json` (written by lessons generator, read by mobile)
```json
{
  "schema_version": 1,
  "units": [
    { "id": "u1-margins", "title": "Margins", "summary": "…", "order": 1,
      "lessons": [
        { "id": "u1-l1", "title": "Gross margin", "xp": 10,
          "intro": "markdown teaching card shown before questions",
          "questions": [
            { "id": "q-…", "type": "multiple_choice | numeric | true_false | compare | order",
              "prompt": "Costco sold $254B of goods. Cost of goods was $222B. What is its gross margin?",
              "choices": ["12.6%", "…"],        // multiple_choice / compare only
              "answer": 0,                        // index (mc/compare), number (numeric), bool (tf), index array (order)
              "tolerance": 0.005,                 // numeric only, absolute on decimal ratios
              "unit": "percent | usd | multiple | none",
              "explanation": "Gross margin = gross profit / revenue = …",
              "source": { "ticker": "COST", "fy": 2025, "metrics": ["gross_margin"], "formula": "gross_profit / revenue" }
            }
          ] }
      ] }
  ]
}
```
Rules: every numeric answer is computed deterministically from companies.json; no LLM-invented
numbers. Content is educational only — never "buy/sell/hold", never price targets.

## Screener filter shape (packages/screener, used by mobile)
```ts
type Filter = { metric: keyof Metrics | keyof Fundamentals; op: '>'|'>='|'<'|'<='|'between'|'=='; value: number | [number, number] };
type Screen = { id: string; name: string; description: string; filters: Filter[]; sort?: { metric: string; dir: 'asc'|'desc' } };
```

## Holdings shape (backend, used later by mobile)
```json
{ "account_id": "…", "institution": "Fidelity", "ticker": "MU", "quantity": 10.5,
  "cost_basis": 950.0, "market_value": 1050.0, "as_of": "2026-09-25", "source": "plaid | snaptrade | manual" }
```
