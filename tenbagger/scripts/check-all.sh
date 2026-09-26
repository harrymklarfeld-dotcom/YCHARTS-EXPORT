#!/usr/bin/env bash
# Tenbagger: run every test suite, type check and build; print PASS/FAIL per suite and a summary.
#
#   bash tenbagger/scripts/check-all.sh                 # everything
#   bash tenbagger/scripts/check-all.sh --quick         # skip slow exports/builds (mobile-export, web-build)
#   bash tenbagger/scripts/check-all.sh --only mobile   # one suite, or a group prefix (mobile = mobile-*)
#   bash tenbagger/scripts/check-all.sh --only pipeline --only lessons
#   bash tenbagger/scripts/check-all.sh --list          # list suite names
#
# Continues after failures; exits 1 if any suite fails. Full logs: $CHECK_LOG_DIR (default: a temp dir).
# Env: DENO=/path/to/deno (else `deno` on PATH), PYTHON=python3, SUITE_TIMEOUT=1200 (seconds),
#      CHECK_NO_INSTALL=1 to never run pip/npm installs.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # .../tenbagger
PY="${PYTHON:-python3}"
SUITE_TIMEOUT="${SUITE_TIMEOUT:-1200}"
QUICK=0
ONLY=()

ALL_SUITES=(pipeline lessons datasources funds finance content screener money budget
  mobile-tsc mobile-jest mobile-export web-build backend-check backend-lint backend-test)
SLOW_SUITES=" mobile-export web-build "

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quick) QUICK=1 ;;
    --only) shift; [[ $# -gt 0 ]] || { echo "--only needs a suite name" >&2; exit 2; }; ONLY+=("$1") ;;
    --only=*) ONLY+=("${1#--only=}") ;;
    --list) printf '%s\n' "${ALL_SUITES[@]}"; exit 0 ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1 (try --help)" >&2; exit 2 ;;
  esac
  shift
done

LOG_DIR="${CHECK_LOG_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/tenbagger-check.XXXXXX")}"
mkdir -p "$LOG_DIR"

if [[ -t 1 ]]; then G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; B=$'\e[1m'; N=$'\e[0m'; else G= R= Y= B= N=; fi

selected() {
  local s="$1" o
  if [[ ${#ONLY[@]} -gt 0 ]]; then
    for o in "${ONLY[@]}"; do [[ "$s" == "$o" || "$s" == "$o"-* ]] && return 0; done
    return 1
  fi
  return 0
}

# ---------- helpers ----------
find_deno() {
  if [[ -n "${DENO:-}" && -x "${DENO}" ]]; then echo "$DENO"; return; fi
  if command -v deno >/dev/null 2>&1; then command -v deno; return; fi
  local c
  for c in /tmp/claude-0/*/*/scratchpad/denoinst/node_modules/@deno/linux-x64-glibc/deno "$HOME/.deno/bin/deno"; do
    [[ -x "$c" ]] && { echo "$c"; return; }
  done
  return 1
}

py_deps() {  # make sure pytest/openpyxl/yaml are importable
  "$PY" -c "import pytest, openpyxl, yaml" 2>/dev/null && return 0
  [[ "${CHECK_NO_INSTALL:-0}" == 1 ]] && { echo "missing python deps (pytest/openpyxl/pyyaml)"; return 1; }
  echo "+ pip install -r pipeline/requirements.txt pyyaml"
  "$PY" -m pip install -q -r "$ROOT/pipeline/requirements.txt" pyyaml
}

npm_deps() {  # npm ci in $1 when node_modules is missing
  local d="$1"
  [[ -f "$d/package.json" ]] || return 0
  [[ -d "$d/node_modules" ]] && return 0
  [[ "${CHECK_NO_INSTALL:-0}" == 1 ]] && { echo "missing $d/node_modules"; return 1; }
  if [[ -f "$d/package-lock.json" ]]; then (cd "$d" && echo "+ npm ci ($d)" && npm ci --no-audit --no-fund)
  else (cd "$d" && echo "+ npm install ($d)" && npm install --no-audit --no-fund); fi
}

# Extract a "passed/total" style count from a suite's log (best effort).
count_from_log() {
  local raw="$1" f p fl
  f="$(mktemp)"; sed -E $'s/\x1b\\[[0-9;]*m//g' "$raw" >"$f"
  _count "$f"; rm -f "$f"
}
_count() {
  local f="$1" p fl
  grep -q '^TIMEOUT after' "$f" && { grep -m1 '^TIMEOUT after' "$f"; return; }
  # pytest: "12 passed, 1 failed, 2 skipped in 0.3s"
  p=$(grep -Eo '[0-9]+ passed' "$f" | tail -1 | grep -Eo '[0-9]+')
  if [[ -n "$p" ]] && grep -Eq '(passed|failed).* in [0-9.]+s' "$f"; then
    fl=$(grep -E ' in [0-9.]+s' "$f" | tail -1 | grep -Eo '[0-9]+ (failed|error)' | awk '{s+=$1} END{print s+0}')
    echo "$p passed${fl:+, $fl failed}" | sed 's/, 0 failed//'; return
  fi
  # vitest: "Tests  42 passed (42)" / jest: "Tests:       3 failed, 40 passed, 43 total"
  if grep -Eq '^ *Tests:? ' "$f"; then
    grep -E '^ *Tests:? ' "$f" | tail -1 | sed -E 's/^ *Tests:? +//; s/ +\([0-9]+\) *$//; s/ +$//'; return
  fi
  # node --test: "# pass 30" / "# fail 0" ("ℹ pass 30" in newer node)
  p=$(grep -Eo '^(#|ℹ) pass [0-9]+' "$f" | tail -1 | grep -Eo '[0-9]+$')
  if [[ -n "$p" ]]; then
    fl=$(grep -Eo '^(#|ℹ) fail [0-9]+' "$f" | tail -1 | grep -Eo '[0-9]+$')
    echo "$p passed${fl:+, $fl failed}" | sed 's/, 0 failed//'; return
  fi
  # deno test: "ok | 60 passed | 0 failed (3s)" / "FAILED | 58 passed | 2 failed"
  if grep -Eq '^(ok|FAILED) \| [0-9]+ passed' "$f"; then
    grep -E '^(ok|FAILED) \| [0-9]+ passed' "$f" | tail -1 | sed -E 's/^(ok|FAILED) \| //; s/ \([^)]*\)$//; s/ \| /, /g; s/, 0 failed//'; return
  fi
  # astro build + link check / expo export / tsc
  p=$(grep -Eo '[0-9]+ page\(s\) built' "$f" | tail -1 | grep -Eo '^[0-9]+')
  if [[ -n "$p" ]]; then
    fl=$(grep -Eo 'Checked [0-9]+ internal links' "$f" | grep -Eo '[0-9]+')
    echo "$p pages${fl:+, $fl links checked}"; return
  fi
  p=$(grep -Eo '^exported [0-9]+ files' "$f" | tail -1); [[ -n "$p" ]] && { echo "$p"; return; }
  p=$(grep -Eo 'Found [0-9]+ errors?' "$f" | tail -1); [[ -n "$p" ]] && { echo "$p"; return; }
  grep -Eq 'error TS[0-9]+' "$f" && { echo "$(grep -Ec 'error TS[0-9]+' "$f") TS errors"; return; }
  echo "-"
}

# ---------- suite definitions (each runs in a subshell; stdout+stderr go to the log) ----------
suite_pipeline()    { py_deps && cd "$ROOT" && "$PY" -m pytest pipeline -q; }
suite_lessons()     { py_deps && cd "$ROOT/lessons" && "$PY" -m pytest -q; }
suite_datasources() { py_deps && cd "$ROOT" && "$PY" -m pytest datasources/tests -q; }
suite_funds()       { py_deps && cd "$ROOT" && "$PY" -m pytest funds -q; }
suite_finance()     { py_deps && cd "$ROOT/.." && "$PY" -m pytest tenbagger/finance/tests -q; }
suite_content()     { cd "$ROOT/content" && npm test; }
suite_screener()    { npm_deps "$ROOT/packages/screener" && cd "$ROOT/packages/screener" && npm run check; }
suite_money()       { npm_deps "$ROOT/packages/money" && cd "$ROOT/packages/money" && npm run check; }
suite_budget() {
  local d="$ROOT/packages/budget"
  [[ -f "$d/package.json" ]] || { echo "SKIP: packages/budget does not exist yet"; return 99; }
  npm_deps "$d" && cd "$d" || return 1
  if node -e 'process.exit(require("./package.json").scripts?.check ? 0 : 1)'; then npm run check; else npm test; fi
}
suite_mobile-tsc()  { npm_deps "$ROOT/mobile" && cd "$ROOT/mobile" && npx tsc --noEmit; }
suite_mobile-jest() { npm_deps "$ROOT/mobile" && cd "$ROOT/mobile" && CI=1 npx jest --ci; }
suite_mobile-export() {
  npm_deps "$ROOT/mobile" && cd "$ROOT/mobile" || return 1
  local out rc; out="$(mktemp -d "${TMPDIR:-/tmp}/tenbagger-mobile-web.XXXXXX")"
  CI=1 npx expo export --platform web --output-dir "$out"; rc=$?
  [[ $rc -eq 0 ]] && echo "exported $(find "$out" -type f | wc -l) files"
  rm -rf "$out"; return $rc
}
suite_web-build() {
  npm_deps "$ROOT/web" && cd "$ROOT/web" || return 1
  if node -e 'process.exit(require("./package.json").scripts?.verify ? 0 : 1)'; then npm run verify; else npm run build; fi
}
backend_deno() {
  local deno; deno="$(find_deno)" || { echo "deno not found: set DENO=/path/to/deno or put deno on PATH"; return 1; }
  cd "$ROOT/backend" && echo "+ $deno $*" && "$deno" "$@"
}
suite_backend-check() { backend_deno task check; }
suite_backend-lint()  { backend_deno lint; }
suite_backend-test()  { backend_deno task test; }

# ---------- runner ----------
declare -a RES_NAME RES_STATUS RES_COUNT RES_TIME
FAILED=0
for s in "${ALL_SUITES[@]}"; do
  selected "$s" || continue
  if [[ $QUICK == 1 && "$SLOW_SUITES" == *" $s "* ]]; then
    RES_NAME+=("$s"); RES_STATUS+=("SKIP"); RES_COUNT+=("--quick"); RES_TIME+=("-")
    echo "${Y}SKIP${N} $s (--quick)"; continue
  fi
  log="$LOG_DIR/$s.log"
  echo "${B}==> $s${N}"
  t0=$(date +%s)
  ( "suite_$s" ) >"$log" 2>&1 &
  pid=$!
  # watchdog so one hung suite can't stall the run
  # (detached from stdout and kills its own sleep, so a piped `check-all.sh | tee` never hangs on it)
  ( trap 'kill "$sp" 2>/dev/null; exit 0' TERM
    sleep "$SUITE_TIMEOUT" & sp=$!; wait "$sp"
    trap '' TERM; kill -0 "$pid" 2>/dev/null && printf "\nTIMEOUT after %ss\n" "$SUITE_TIMEOUT" >>"$log"
    pkill -TERM -P "$pid" 2>/dev/null; kill -TERM "$pid" 2>/dev/null
  ) </dev/null >/dev/null 2>&1 &
  wd=$!
  wait "$pid"; rc=$?
  kill "$wd" 2>/dev/null; wait "$wd" 2>/dev/null
  dt=$(( $(date +%s) - t0 ))
  cnt="$(count_from_log "$log")"
  if [[ $rc -eq 99 ]]; then
    st=SKIP; cnt="$(tail -1 "$log")"; echo "${Y}SKIP${N} $s  $cnt"
  elif [[ $rc -eq 0 ]]; then
    st=PASS; echo "${G}PASS${N} $s  ($cnt, ${dt}s)"
  else
    st=FAIL; FAILED=1; echo "${R}FAIL${N} $s  (exit $rc, $cnt, ${dt}s) log: $log"
    tail -n 25 "$log" | sed 's/^/    | /'
  fi
  RES_NAME+=("$s"); RES_STATUS+=("$st"); RES_COUNT+=("$cnt"); RES_TIME+=("${dt}s")
done

if [[ ${#RES_NAME[@]} -eq 0 ]]; then echo "no suite matched --only ${ONLY[*]} (see --list)" >&2; exit 2; fi

echo
echo "${B}Summary${N}  (logs: $LOG_DIR)"
printf '%-15s %-5s %-8s %s\n' SUITE STATUS TIME TESTS
printf '%-15s %-5s %-8s %s\n' --------------- ------ -------- --------------------
for i in "${!RES_NAME[@]}"; do
  c="${RES_STATUS[$i]}"; col=$G; [[ $c == FAIL ]] && col=$R; [[ $c == SKIP ]] && col=$Y
  printf '%-15s %s%-6s%s %-8s %s\n' "${RES_NAME[$i]}" "$col" "$c" "$N" "${RES_TIME[$i]}" "${RES_COUNT[$i]}"
done
if [[ $FAILED == 1 ]]; then echo "${R}${B}FAILED${N}"; exit 1; fi
echo "${G}${B}ALL PASSED${N}"
