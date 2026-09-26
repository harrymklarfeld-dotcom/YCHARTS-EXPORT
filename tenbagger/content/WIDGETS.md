# Article widgets: spec

Articles are plain Markdown with YAML frontmatter. Interactive pieces are **fenced code blocks
whose info string starts with `widget:`**. Any Markdown tool that doesn't know about widgets shows them
as small code blocks, so nothing breaks. The app and the website swap them for live components.

~~~text
```widget:metric ticker=COST metric=gross_margin
```
~~~

- **Parameters** are `key=value` pairs on the opening line, separated by spaces. If a value has spaces,
  quote it: `caption="Peak year"`. Long widgets can put extra `key=value` pairs on the lines inside the
  block, one or more per line. Lines starting with `#` inside a block are comments.
- The **one-line form** (```` ```widget:quiz lesson=u2-l1``` ````) also works. Prefer the two-line form,
  because a CommonMark viewer treats the one-line form as inline code.
- Every widget accepts an optional `caption="…"` that is shown under it.
- The machine-readable version of this page is [`widgets.json`](widgets.json). `build.mjs` validates against it.
  Anything unknown (a widget, parameter, ticker, metric, lesson or unit) **fails the build**, and so does a
  company that has no value for the metric you asked for (for example, JPM has no gross margin).

## The seven widgets

| Widget | Required | Optional | What the reader sees |
|---|---|---|---|
| `widget:metric` | `ticker`, `metric` | `caption` | One live number, its formula, and the formula's inputs filled in (`gross profit / revenue = $15.0B / $37.4B = 40.1%`) |
| `widget:compare` | `tickers` (2–6, comma-separated), `metric` | `caption` | A horizontal bar chart of one metric across companies. Negative values are drawn left of zero |
| `widget:history` | `ticker`, `metric` (a history series) | `average=true`, `caption` | Annual bars from `history`. Negative years show in red below the zero line. `average=true` adds a dashed average line and its value |
| `widget:quiz` | `lesson` (id from `data/lessons.json`) | `caption` | A "Practice this" card (lesson title, unit, question count, XP). It opens that lesson. **XP only comes from finishing the lesson.** Reading earns nothing |
| `widget:calculator kind=pe` | `ticker` **or** `price`+`eps` | `required_return` (default 0.09) | Price and EPS sliders showing P/E, earnings yield, and the growth the price implies |
| `widget:calculator kind=dcf` | `ticker` **or** `fcf` | `growth` 0.05, `discount` 0.09, `terminal` 15, `years` 5, `net_cash`, `shares`, `normalized_fcf`, `cyclical=true` | FCF, growth, discount-rate and terminal-multiple sliders showing estimated value, and a **"Cyclical: use normalized FCF"** toggle |
| `widget:calculator kind=liquidity` | (none) | `cash` 3000, `card` 1500 | Cash and card-balance sliders showing the personal liquidity ratio and a grade band (same bands as the Money hub) |

**History series** (`widget:history metric=`): `revenue`, `net_income`, `free_cash_flow`, `eps_diluted`,
`gross_margin`, `operating_margin`, `total_debt`, `cash`.

**Metric keys** (`widget:metric` / `widget:compare`): every key in CONTRACT.md `metrics` and `fundamentals`,
plus `price`. Labels, display formats and formulas are listed in `widgets.json → metrics`, and a copy is
included in `data/articles.json → metrics`.

## Output shape (`data/articles.json`)

```json
{
  "schema_version": 1,
  "generated_at": "2026-09-25T00:00:00Z",
  "widget_spec_version": 1,
  "provenance": { "real_fixture_tickers": ["MU"] },
  "metrics": { "gross_margin": { "label": "Gross margin", "format": "percent", "source": "metrics", "formula": "gross profit / revenue", "terms": ["gross_profit", "revenue"] } },
  "articles": [
    {
      "slug": "gross-margin", "title": "…", "summary": "…", "minutes": 6, "level": "beginner",
      "unit": "u2-margins", "relatedLessons": ["u2-l1"], "metrics": ["gross_margin"], "tags": ["margins"],
      "updated": "2026-09-25", "widgetCount": 3, "sampleTickers": ["AAPL", "COST"], "wordCount": 812,
      "blocks": [
        { "type": "markdown", "md": "## …" },
        { "type": "widget", "kind": "compare", "params": { "tickers": ["COST", "AAPL"], "metric": "roic" } },
        { "type": "widget", "kind": "calculator", "params": { "kind": "dcf", "ticker": "MU", "growth": 0.05, "discount": 0.09, "terminal": 15, "years": 5, "cyclical": false } }
      ]
    }
  ]
}
```

Params have already been converted to the right types. `tickers` is an array, numbers are numbers,
booleans are booleans, and defaults are filled in. Renderers read the live values from `data/companies.json`.

## Rendering rules (the app and the web must agree)

**Formats.** `percent` gives `40.1%`. `usd` gives `$37.4B`, `$1.2T` or `−$5.7B`. `multiple` gives `18.2×`. `ratio` gives `2.52`. `per_share` gives `$7.59`. `count` gives `1.13B`.
`null` is shown as `—`.

**`metric` inputs line.** If the catalog entry has `terms: [a, b]`, show `formula = a / b = value`, using `op` if
it is given (`×` or `−`, default `/`). `price` comes from the company's top-level `price`.

**Sample data.** A company counts as *sample* when `companies.json.source == "fixture"` and its ticker is not in
`provenance.real_fixture_tickers`. If the pipeline ever adds a company-level `fundamentals_is_sample` boolean,
that flag wins. Every widget that shows a sample company's numbers carries a visible **"Sample data"** tag.
A widget that uses `price` (P/E, market cap, yields, the P/E calculator) also carries **"Sample price"** when
`price_is_sample` is true. `article.sampleTickers` lists the sample companies an article uses, so a page can
add a banner.

**Calculator math.** These functions are mirrored in `mobile/src/articles/calc.ts` and unit-tested there.

- **P/E.** `pe = price / eps`, shown as `n/m` when eps ≤ 0. `earnings_yield = eps / price`.
  `implied_growth ≈ required_return − earnings_yield` (curriculum 7.5: *required return ≈ earnings yield + growth*).
- **DCF.** Let `f0` be the starting FCF, `g` growth, `r` discount, `m` the terminal multiple and `N` the years.
  - `PV_years = Σ_{t=1..N} f0·(1+g)^t / (1+r)^t`
  - `PV_terminal = f0·(1+g)^N · m / (1+r)^N`
  - `value = PV_years + PV_terminal + net_cash`
  - `per_share = value / shares`
  - Also show `terminal_share = PV_terminal / (PV_years + PV_terminal)`.
  - With a `ticker`, `f0`, `net_cash` and `shares` default to the company's `free_cash_flow`, `net_cash` and `shares_diluted`.
  - **Normalized FCF** is the mean of every non-null year in `history.free_cash_flow`, or `normalized_fcf` if that is given. When the toggle is on, `f0` = normalized FCF.
  - Sliders: FCF runs from 0 to 3 × max(|FCF|, |normalized|). Growth runs from −10% to 25% in 0.5% steps. Discount runs from 5% to 15% in 0.25% steps. The terminal multiple runs from 5× to 30× in 0.5 steps.
- **Liquidity** (personal current ratio, same as `packages/money`). `ratio = cash / card`, or "no card balance" when card = 0.
  Grades: **A** ≥ 2.0 (or no card balance), **B** 1.5–2.0, **C** 1.0–1.5, **D** 0.75–1.0, **F** < 0.75. Also show `cash − card`.
  Sliders: cash from $0 to max($20,000, 3 × cash) in $100 steps. Card from $0 to max($10,000, 3 × card) in $50 steps.

## Markdown subset

Supported: `##` and `###` headings, paragraphs, `**bold**`, `*italic*`, `` `code` ``, `[links](https://…)`,
`-` and `1.` lists (one level), `>` blockquotes, fenced code, and `---` rules.
**Not supported (the build fails):** `#` H1 (the title comes from frontmatter), images, tables and raw HTML.
Use a `compare` widget or a list instead of a table.

## Voice

Educational, never advice. The build runs the same banned-phrase guard as the lesson generator. It rejects
`buy`, `sell`, `hold`, `price target`, `undervalued`, `cheap`, `you should`, `recommend`, `outperform`
and similar words. Write "customers paid for", "the market price implies", "a reader might check".
Numbers written in the prose must come from Micron's real data, or be clearly illustrative
("imagine a shop that…"). If you mention a sample company's number, say it is sample data.
