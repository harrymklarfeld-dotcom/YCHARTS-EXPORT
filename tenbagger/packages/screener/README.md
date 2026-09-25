# @tenbagger/screener

A zero-runtime-dependency TypeScript screener engine for Tenbagger. It runs over
`data/companies.json` (see `tenbagger/CONTRACT.md`) and gives you:

- a **metric catalog** with friendly labels, beginner explainers and formatters
- **`runScreen`**: null-safe filtering, sorting with nulls last, and a count of companies left out for missing data
- **peer helpers** for copy like *"By P/E (15x), cheaper than 80% of Technology companies"*
- **10 preset screens** with educational descriptions and caveats. They are not recommendations.
- **`explainMatch`**: lines like `ROIC 31% (needs > 15%) ✓`
- **`parseQuery`**: `"pe < 20 and roic > 15%"` → `Filter[]`, with helpful errors

All functions are pure and deterministic. Nothing depends on Node, Intl or the DOM, so the
package runs the same way in Hermes/React Native and in Node.

## Install / build

```bash
cd tenbagger/packages/screener
npm install          # dev deps only: typescript, vitest
npm run typecheck
npm run build        # -> dist/ (ESM + .d.ts)
npm test
npm run check        # all three
```

Source files import each other with `.ts` extensions, and `tsc` rewrites these to `.js`
(`rewriteRelativeImportExtensions`, TS ≥ 5.7). Because of this, Metro can bundle `src/`
directly through the `react-native` export condition, and Node and other bundlers use `dist/`.

From the Expo app, use a file dependency:

```json
"@tenbagger/screener": "file:../packages/screener"
```

## Quick start

```ts
import companiesFile from '../data/companies.json';
import {
  runScreen, explainMatch, PRESET_SCREENS, getPresetScreen,
  compareToPeers, sectorMedian, parseQuery, METRIC_CATALOG, getMetricInfo,
  type CompaniesFile,
} from '@tenbagger/screener';

const { companies } = companiesFile as CompaniesFile;

// 1. Presets
const out = runScreen(companies, getPresetScreen('quality-fair-price')!);
out.results.map((r) => r.company.ticker);     // ['TWN1', 'TWN2', 'NEGQ', 'QLTY'] (sorted by ROIC desc)
out.excludedForMissingData;                    // 0
explainMatch(out.results[0]!.company, getPresetScreen('quality-fair-price')!);
// ['ROIC 25% (needs > 15%) ✓', 'P/E 16.7x (needs < 25x) ✓']

// 2. Typed queries
const filters = parseQuery('fcf margin > 20% and p/e under 20');
runScreen(companies, { id: 'mine', name: 'My screen', description: '', filters,
  sort: { metric: 'fcf_margin', dir: 'desc' } });

// 3. Peers
compareToPeers(companies, 'pe', 'MU', { sector: 'sector' })?.sentence;
// "By P/E (12.4x), cheaper than 80% of Technology companies."
sectorMedian(companies, 'Technology', 'gross_margin');   // 0.62

// 4. Catalog
getMetricInfo('roic')!.format(0.312);   // "31%"
getMetricInfo('roic')!.explainer;       // plain-English 1–2 sentences
```

## API

### Types (mirror the contract)

`Company`, `CompaniesFile`, `Fundamentals`, `Metrics`, `History`, `MetricKey`,
`FundamentalKey`, `FieldKey = MetricKey | FundamentalKey`, `FilterOp`, `Filter`, `Screen`.

```ts
type Filter = { metric: FieldKey; op: '>'|'>='|'<'|'<='|'between'|'=='; value: number | [number, number] };
type Screen = { id: string; name: string; description: string; filters: Filter[];
                sort?: { metric: string; dir: 'asc'|'desc' } };
```

`Company.metrics` and `Company.fundamentals` are typed as `Partial<…>`. A missing key is
treated exactly like `null`.

### Catalog

| Export | Description |
|---|---|
| `METRIC_CATALOG: readonly MetricInfo[]` | All 22 metrics and all 22 fundamentals, in contract order, frozen |
| `METRIC_KEYS`, `FUNDAMENTAL_KEYS` | The contract keys |
| `getMetricInfo(key)` | `MetricInfo \| undefined` |
| `isFieldKey(key)`, `isMetricKey(key)` | Type guards |
| `formatValue(key, value)` | Formats using the catalog unit; `null` → `"—"` |

```ts
interface MetricInfo {
  key: FieldKey; source: 'metric' | 'fundamental';
  label: string;          // "Return on invested capital"
  shortLabel: string;     // "ROIC"
  explainer: string;      // 1–2 beginner sentences
  unit: 'percent' | 'usd' | 'multiple' | 'ratio' | 'count';   // 'count' = share counts only
  higherIsBetter: boolean | null;   // null = depends / size-like
  category: MetricCategory;         // 'valuation' | 'profitability' | 'returns' | ...
  formula?: string;                 // contract formula (metrics)
  learnMoreLessonId: string;        // `metric:<key>` — deep-link hook for lessons
  format(value): string;            // "31%", "$1.2B", "18.2x", "1.50", "—"
}
```

Formatters: `formatPercent`, `formatUsd`, `formatMultiple`, `formatRatio`, `formatCount`,
`formatByUnit`, `MISSING` (`"—"`). They never output `NaN`.

### Screening

`runScreen(companies, screen): RunScreenOutput`

```ts
interface RunScreenOutput {
  results: { company: Company; matched: true; values: Partial<Record<FieldKey, number | null>> }[];
  excludedForMissingData: number;   // left out ONLY because a filtered metric was null
  missingData: { ticker: string; missing: FieldKey[] }[];
  total: number;                    // number of companies checked
}
```

- A company matches only if it passes **every** filter.
- `null`, a missing key, `NaN` or `±Infinity` **never** passes any numeric filter, including a
  very wide `between`.
- `excludedForMissingData` counts companies where every filter that had data passed and at
  least one filter had no data. These are companies that *might* have matched. A company that
  also failed a filter with real data does not count.
- `between` is **inclusive** at both ends: `[lo, hi]` means `lo ≤ x ≤ hi`, and `lo` must be `≤ hi`.
- `==` uses a small relative tolerance (1e-9), so `0.1 + 0.2 == 0.3` passes.
- Sorting: nulls always come **last** in both directions, and ties keep their input order
  (stable). If there is no `sort`, results keep their input order.
- `values` holds every filtered metric and the sort metric.
- A malformed screen (unknown metric, bad operator, reversed or non-numeric bounds) throws
  `ScreenError` with `.issues: string[]`. To check a screen without throwing, call
  `validateScreen(screen)`, which returns a `string[]`.
- Inputs are never mutated.

Lower-level helpers: `getValue(company, key)`, `testValue(value, filter)`,
`checkCompany(company, filters)` (per filter `'pass' | 'fail' | 'missing'`),
`matchesScreen`, `validateFilter`, `compareNullable`, `describeCondition`, `FILTER_OPS`.

`explainMatch(company, screen): string[]` returns one line per filter:

```
ROIC 31% (needs > 15%) ✓
P/E 18.2x (needs < 15x) ✗
FCF margin — no data (needs > 20%) ✗
Debt/Equity 0.30 (needs between 0.00 and 0.50) ✓
```

### Peers

| Export | Returns |
|---|---|
| `percentileRank(companies, metric, ticker, opts?)` | `number \| null`: the % (0–100, 1 decimal) of **other** companies with data whose value is **strictly lower** |
| `compareToPeers(companies, metric, ticker, opts?)` | `{ value, peerCount, pctBelow, pctAbove, peerMedian, groupLabel, sentence } \| null` |
| `sectorMedian(companies, sector, metric)` | `number \| null` (sector match is case-insensitive; nulls skipped) |
| `median(values)` | `number \| null` |

`opts.sector`: pass `'sector'` to compare with the target's own sector, pass a sector name to
compare with that sector, or leave it out to compare with all companies. Tied values count as
neither above nor below. The functions return `null` if the ticker is unknown, the target
value is null, or no peer has data.

Wording of `sentence`:
- For P/E, P/S, P/B and EV/EBITDA it says *"By P/E (15x), cheaper than 80% of Technology companies."* This uses `pctAbove`.
- For FCF yield and earnings yield it also says *cheaper than*, using `pctBelow`.
- For any other metric, it says *"higher than X%"*. If `higherIsBetter === false`, it says *"lower than X%"* instead.

### Presets

`PRESET_SCREENS: readonly PresetScreen[]` (deep-frozen) and `getPresetScreen(id)`.
`PresetScreen` extends `Screen` with `emoji`, `caveat` (what the screen can miss) and
`learnMoreLessonId` (`preset:<id>`).

| id | Name | Filters | Sort |
|---|---|---|---|
| `cash-machines` | Cash machines | FCF margin > 20% | FCF margin ↓ |
| `quality-fair-price` | Quality at a fair price | ROIC > 15%, P/E < 25 | ROIC ↓ |
| `fortress-balance-sheets` | Fortress balance sheets | net cash > 0, current ratio > 1.5 | net cash ↓ |
| `dividend-payers` | Dividend payers | dividend yield > 0 | yield ↓ |
| `fast-growers` | Fast growers | 3y revenue CAGR > 20% | CAGR ↓ |
| `deep-value` | Deep value | EV/EBITDA < 8 | EV/EBITDA ↑ |
| `profitable-and-growing` | Profitable & growing | net margin > 10%, revenue growth > 10% | growth ↓ |
| `low-debt` | Low debt | debt/equity between 0 and 0.5 (excludes negative equity) | D/E ↑ |
| `pricing-power` | Pricing power | gross margin > 50%, operating margin > 20% | op. margin ↓ |
| `steady-compounders` | Steady compounders | ROIC > 12%, op. margin > 10%, 3y CAGR between 5% and 20% | ROIC ↓ |

Preset descriptions explain what each screen looks for and why someone might study it. They
never tell anyone to trade a stock. A test enforces this by checking for banned phrases
(buy/sell/strong buy/price target/recommend/…).

### Query parser

`parseQuery(text): Filter[]` throws a `QueryParseError` (with `.errors` and `.warnings`) if the
query is invalid. `safeParseQuery(text)` returns `{ ok, filters, errors, warnings }` and never
throws. Each issue is `{ message, position }`, where `position` is a 0-based character offset.

- **Joiners**: `and`, `&`, `&&`, `,`, `;`. `or` is not supported, and the parser says so.
- **Metrics**: contract keys (`ev_ebitda`), short labels (`EV/EBITDA`, `P/E`), full labels
  (`return on invested capital`) and aliases (`market cap`, `d/e`, `fcf margin`, `3y revenue cagr`, `yield`, …).
  Use `resolveMetric(name)` to look one up and `suggestMetric(typo)` to find the closest match.
- **Operators**: `> >= < <= = == ≥ ≤`, `over`, `above`, `more/greater/higher than`, `under`, `below`,
  `less/lower/fewer than`, `at least`, `at most`, `no more than`, `between X and Y` (or `X to Y`).
  A filler `is` is ignored (`pe is under 20`).
- **Numbers**: `0.15`, `15%`, `1,000,000`, `$10b`, `2.5m`, `3 billion`, `1.5T`, `-$1b`, `18x`.
- **Percent metrics**: a bare number above 1 is read as a percent. For example, `roic > 15`
  becomes 0.15, and the parser adds a warning. Reversed `between` bounds are swapped, also with
  a warning.

Example errors:

```
Unknown metric "pee". Did you mean "pe" (Price-to-earnings)?
Expected a comparison like ">", "<" or "between" after "pe" but found the number "20".
Expected "and" between conditions but found "roic".
"between" needs two numbers, like "pe between 0.1 and 0.2".
```

## v2 additions (all backward compatible)

Everything below is pure, deterministic and dependency-free, like the rest of the package.

### Funnel — `funnel(companies, screen | Filter[])`

Applies filters one at a time, in order. Returns `{ start, steps[], final, biggestCut }`, where each
step is `{ index, filter, label, before, after, removed, removedForMissingData }`. `final` always
equals `runScreen(...).results.length`. The UI shows "→ 128 left" on each chip and a funnel bar.

### Concentration — `concentration(results, { threshold = 0.6, minResults = 3 })`

Accepts companies or `runScreen` results. Returns `{ total, groups[], top, isConcentrated, note }`.
When the top sector's share is **above** 60% (and there are at least 3 results), `note` holds a
short teaching text plus a `lessonId` from `data/lessons.json` (`SECTOR_NOTES`, falling back to
`GENERIC_SECTOR_NOTE`). A test checks that every lesson id exists.

### Scores — `scores(companies)`, `scoresByTicker`, `SCORE_FAMILIES`

Four **educational** scores (not ratings), each 0–100:

| Family | Inputs (direction that ranks higher) |
|---|---|
| Quality | ROIC ↑, gross margin ↑, FCF margin ↑, debt/equity ↓ |
| Value | earnings yield ↑, FCF yield ↑, EBITDA/EV ↑ (= 1 / EV/EBITDA) |
| Growth | 3y revenue CAGR ↑, EPS growth ↑ |
| Balance sheet | debt/equity ↓, current ratio ↑, net cash / total assets ↑ |

Each input's percentile is `(others strictly below + ½ × others tied) / (n − 1) × 100` among the
companies in the list that have that number, flipped for "lower ranks higher". A lone company gets
50. The family score is the rounded average of the available percentiles; it needs at least half the
inputs (otherwise `null`). Negative debt/equity (negative equity) ranks as the most debt. Every
`FamilyScore` returns its `components` (value, display, percentile, peers, formula), the full
`formula` text and a `working` line such as `Average of 4 percentiles: 56, 100, 89, 83 → 82`.

### Style buckets — `styleBox(company, universe)`, `styleBoxes`, `filterByStyle`, `STYLE_BOX_CONFIG`

Size: market cap ≥ $10B Large, ≥ $2B Mid, otherwise Small (configurable). Style: `priceLevel` =
average percentile of P/E and P/B (positive values only), `growthLevel` = percentile of 3y revenue
CAGR (falls back to 1y growth), `styleScore` = their average; ≤ 33⅓ Value, ≥ 66⅔ Growth, else Blend.
The result includes a plain-English `explanation`.

### Ask the screener — `mockAssist`, `validateAssistOutput`, `ASSIST_TOOL`, `buildAssistSystemPrompt`

* `mockAssist(text)`: exact `safeParseQuery` first; otherwise splits into clauses, parses each and maps
  fuzzy words through `ASSIST_SYNONYMS` ("cheap" → P/E < 15 and P/B < 2, "low debt" → D/E 0–0.5, …).
  Every synonym adds a visible note ("“cheap” was read as …. Edit the chips …"). Leftover words are
  returned in `unrecognized`; `needsModel(result)` says whether a model call could help.
* `ASSIST_TOOL` / `buildAssistSystemPrompt()`: the strict tool schema (metric enum = catalog keys) and
  a byte-stable system prompt (catalog keys, units, ops, house conventions, examples; no company
  data), sized above Haiku 4.5's 4,096-token cache minimum so it can be prompt-cached.
* `validateAssistOutput(raw)`: rejects unknown metrics / ops / non-finite values, caps filters at 8,
  and replaces the model's restatement when it is too long, uses advice words, or mentions any number
  that is not a filter threshold (`restatementNumbersMatch`). `restateFilters` is the deterministic
  fallback. `mergeFilters` implements "Add to this screen".

### Language guard — `BANNED_PHRASES`, `findBannedPhrases`, `isCleanLanguage`

Extends the preset test's list with rating labels (Attractive, Avoid, Outperform, Overweight, top
pick, overvalued, …). Tests run it over all score, style, concentration and assist copy.

### CSV — `toCsv(companies, columns, { sourceNote })`, `catalogCsvColumn`, `csvCell`

RFC 4180 output with raw numbers (decimals for percents, raw USD), identity columns first, a
`# source` line last, and formula-injection protection for text cells.

## Tests

```bash
npm test
```

The tests use `vitest` and a fixture of 10 fictional companies that follow the contract, in
`tests/fixtures/companies.json`. The metrics in the fixture are derived with the exact
formulas from CONTRACT.md by `tests/fixtures/make-fixture.mjs`. The fixture covers these edge
cases:

- a loss-maker (null P/E and EV/EBITDA)
- negative equity
- a bank with no current ratio or gross margin
- a new listing with null growth figures
- identical "twin" companies, used to test that sorting is stable
