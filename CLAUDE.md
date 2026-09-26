# Repo guide

Two projects live here:

- `ycharts_export/`, `data/`, `reports/`: the original personal fundamentals toolkit (Micron valuation). See README.md.
- `tenbagger/`: the Tenbagger app (working name). A Gen Z investing-education app: Duolingo-style lessons built on
  real SEC financials, a friendly screener, fund X-ray, and a money hub/budget for students with irregular income.

## Tenbagger layout

| Path | What | Check command |
|---|---|---|
| `tenbagger/CONTRACT.md` | Shared data shapes (companies.json, lessons.json, holdings, filters). Read before changing any data shape. | |
| `tenbagger/pipeline/` | Python: SEC EDGAR → `data/companies.json` | `cd tenbagger && python -m pytest pipeline -q` |
| `tenbagger/lessons/` | Python: generates `data/lessons.json` from companies | `cd tenbagger/lessons && python -m pytest -q` |
| `tenbagger/content/` | Markdown articles with widgets → `data/articles.json` | `cd tenbagger/content && npm test` |
| `tenbagger/funds/`, `datasources/`, `finance/` | Fund N-PORT parsing, data adapters + licence gate, P&L model | pytest |
| `tenbagger/packages/{screener,money,budget}` | Pure TS engines (zero runtime deps, vitest) | `npm run check` in each |
| `tenbagger/mobile/` | Expo app (expo-router, TS strict, zustand). Imports packages via relative `../../../packages/<pkg>/src/index.ts` | `npx tsc --noEmit && npx jest` |
| `tenbagger/web/` | Astro site; rebrand via `web/site.config.ts` | `npm run verify` |
| `tenbagger/backend/` | Supabase SQL + Deno edge functions (Plaid/SnapTrade behind a provider interface, mock mode) | `deno task test` |
| `tenbagger/prototypes/` | Clickable HTML design directions (v1, v2) | |
| `tenbagger/docs/` | Research, strategy, ROADMAP.md (current plan + decision log), BUILD_BUDGET.md, HEALTH.md | |

**Run everything:** `bash tenbagger/scripts/check-all.sh` (`--quick` skips builds, `--only <suite>`). CI mirrors it in
`.github/workflows/tenbagger-ci.yml`. Keep it green.

## Rules (non-negotiable)

- **Education, not advice.** Explain metrics; never tell users what to buy/sell/hold, no price targets or ratings.
  `tenbagger/scripts/compliance-scan.mjs` enforces the wording in CI.
- **Rewards only for learning.** No XP/streaks/badges for trading, deposits or returns; no gambling mechanics.
- **Money copy is shame-free and labelled** (verified / projected / pending / estimate); no cash advances or credit offers.
- **No invented numbers.** Lesson answers are computed from data; sample data is labelled as sample.
- **No real personal data in git.** Founder data lives in git-ignored `tenbagger/private/` or `*.local.json`.
- **Licensed data only on public surfaces.** Don't scrape YCharts; the datasources licence gate must pass before publishing prices.
- Sandbox note: SEC and most financial hosts are blocked in the dev container; code must work offline on fixtures.

## Working style

- Read `tenbagger/docs/ROADMAP.md` first; update its decision log when a decision is made.
- Keep token use lean (see `tenbagger/docs/BUILD_BUDGET.md`): ≤3 parallel agents, reuse existing docs.
- Standing agents in `.claude/agents/`: `contrarian` (pushback), `code-health` (tests/CI), `market-analyst`,
  `design-lead` (design system), `compliance-reviewer` (advice/privacy/accuracy). Run the relevant one after a change lands.
