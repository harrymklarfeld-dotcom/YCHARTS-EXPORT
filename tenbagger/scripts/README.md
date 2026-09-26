# tenbagger/scripts

## check-all.sh

One command for every test suite, type check and build in `tenbagger/`. Run it from anywhere:

```bash
bash tenbagger/scripts/check-all.sh                  # everything (about 5-10 min)
bash tenbagger/scripts/check-all.sh --quick          # skip mobile-export and web-build
bash tenbagger/scripts/check-all.sh --only mobile    # one suite, or a group prefix (mobile-*, backend-*)
bash tenbagger/scripts/check-all.sh --only lessons --only money
bash tenbagger/scripts/check-all.sh --list           # suite names
```

It prints PASS / FAIL / SKIP per suite (with the last 25 log lines of each failure), then a summary
table with test counts and times. It keeps going after a failure and exits 1 if any suite failed.
Full logs are written to `$CHECK_LOG_DIR` (default: a new temp dir, printed in the summary).

| Suite | Runs |
|---|---|
| pipeline | `python -m pytest pipeline -q` (from `tenbagger/`) |
| lessons | `python -m pytest -q` (from `tenbagger/lessons/`) |
| datasources | `python -m pytest datasources/tests -q` |
| funds | `python -m pytest funds -q` |
| finance | `python -m pytest tenbagger/finance/tests -q` (from repo root) |
| content | `npm test` in `content/` (node:test, no deps) |
| screener, money | `npm run check` (typecheck + build + vitest) in `packages/<name>/` |
| budget | `npm run check` (or `npm test`) in `packages/budget/`; SKIP until the package exists |
| mobile-tsc / mobile-jest | `npx tsc --noEmit` / `npx jest --ci` in `mobile/` |
| mobile-export | `npx expo export --platform web` into a temp dir, deleted afterwards |
| web-build | `npm run verify` (astro build + link check) in `web/` |
| backend-check / -lint / -test | `deno task check`, `deno lint`, `deno task test` in `backend/` |

Dependencies: when missing, Python deps are installed from `pipeline/requirements.txt` plus `pyyaml`,
and `npm ci` runs in any project without `node_modules`. Set `CHECK_NO_INSTALL=1` to disable that.

Environment variables:

* `DENO`: path to a deno binary. Otherwise `deno` on `PATH`, then `~/.deno/bin/deno`.
* `PYTHON`: interpreter (default `python3`).
* `SUITE_TIMEOUT`: per-suite limit in seconds (default 1200).
* `CHECK_LOG_DIR`: where to keep the logs.

CI (`.github/workflows/tenbagger-ci.yml`) calls this same script with `--only <suite>`, one job per
project, so a local run and CI check the same things.
