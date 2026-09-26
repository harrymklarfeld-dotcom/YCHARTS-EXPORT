# Tenbagger code health

Written by the `code-health` agent (`.claude/agents/code-health.md`). Newest run first.
Reproduce any run with `bash tenbagger/scripts/check-all.sh` (see `tenbagger/scripts/README.md`).
CI runs the same script per suite: `.github/workflows/tenbagger-ci.yml`.

---

## 2026-09-26: first run (tooling created)

**Overall: GREEN.** All 16 suites pass: 710 tests, plus type checks, lint and builds. Nothing is failing.
The amber items under "Integration drift" are gaps, not breakages.

| Suite | Status | Tests / output |
|---|---|---|
| pipeline | PASS | 48 passed |
| lessons | PASS | 65 passed |
| datasources | PASS | 20 passed |
| funds | PASS | 28 passed |
| finance | PASS | 22 passed (includes the LibreOffice recalc test; it is skipped in CI, see below) |
| content | PASS | 27 passed |
| packages/screener | PASS | typecheck + build + 122 passed |
| packages/money | PASS | typecheck + build + 110 passed |
| packages/budget | PASS | typecheck + 11 passed (new package, work in progress) |
| mobile-tsc | PASS | `tsc --noEmit`, 0 errors |
| mobile-jest | PASS | 188 passed |
| mobile-export | PASS | web export, 22 files (temp dir, deleted) |
| web-build | PASS | 81 pages, 4525 internal links checked, 0 broken |
| backend-check | PASS | `deno task check` (10 function entrypoints + tests + scripts) |
| backend-lint | PASS | `deno lint`, 43 files |
| backend-test | PASS | 69 passed (the README still says 60) |

### Failures seen during the run

* **packages/budget (transient, work in progress):** during the run, the package failed twice while another
  agent was scaffolding it. First `tsc` returned `TS18003: No inputs were found` because `src/` was still empty.
  Then vitest reported `No test files found` because `tests/` was not written yet. The final run passes with
  11 tests. No action needed.

### Integration drift and gaps (amber, nothing broken)

1. **`data/companies.json` is fixture data:** `"source": "fixture"`, 12 companies. Mobile, web and the
   lessons build all ship from this file. The real EDGAR build (`tenbagger-data.yml`, `min_count` 400) has
   not produced a published file yet. This blocks launch until a data-branch or Supabase publish exists.
2. **CONTRACT.md lags the data files:**
   * `companies[].data_notes` is present in the data but not in the contract.
   * The top-level `lessons.json` keys `generated_from` and `disclaimer` are undocumented, and so is the
     per-question key `personalization`.
   * The contract does not mention `data/articles.json` (content → mobile) or `data/funds.json`
     (funds → mobile) at all. Mobile relies on both: `mobile/src/articles/data.ts` and
     `mobile/src/funds/data.ts`.
   * Fix: add short sections to CONTRACT.md, or point it at `content/README.md` and `funds/README.md`
     as the schema owners.
3. **Screener import paths are inconsistent in mobile.** Across mobile, `../../../packages/screener/src` is
   imported in three spellings: `/index.ts` (12 import sites), `/index` (7) and `/src` (1). They all resolve, but
   one alias or a single re-export would stop drift. `mobile/src/lib/screener.ts` already documents one.
   This is a recommendation only.
4. **Cross-package test fixture:** `mobile/src/money/__tests__/hub.test.ts` imports
   `packages/money/tests/fixtures/alex.sample.json`. This is test-only, so it is fine, but renaming the
   fixture would break mobile's tests. That area is currently being edited by another agent.
5. **The finance LibreOffice test is skipped in CI.** `finance/tests/test_model.py:185` skips when
   `soffice` is missing, which is the case on GitHub's ubuntu runner. Locally it runs. To enforce it in CI,
   add `sudo apt-get install -y libreoffice-calc` to the finance matrix leg (+~1 min).
6. **Docs drift:** `backend/README.md` says "60 tests", but the actual count is 69.

The TODO/FIXME scan of project code (excluding node_modules, dist and prototypes) found no TODOs.

### What this run fixed or added

* Added `tenbagger/scripts/check-all.sh` with `--quick`, `--only`, `--list`, a per-suite timeout, a summary
  table and logs. Also added `tenbagger/scripts/README.md`.
* Added `.github/workflows/tenbagger-ci.yml`. It runs one job per project (Python 3.11 matrix, Node 22
  matrix, mobile, web, and Deno through `denoland/setup-deno@v2`), with `contents: read` and concurrency
  cancel-in-progress. It passed actionlint.
* No project code was changed.
