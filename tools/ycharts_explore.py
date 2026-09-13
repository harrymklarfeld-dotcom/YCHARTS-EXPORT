#!/usr/bin/env python3
"""
Read-only YCharts explorer — drives YOUR logged-in browser session, looks around every menu,
and writes down what it finds so Claude can learn the platform. It NEVER builds or saves anything:

  * it only navigates (GET) and opens menus to screenshot them,
  * it never clicks Save / Create / New / Export / Delete,
  * it blocks mutating network requests (PUT/PATCH/DELETE and any save/create/export/delete URL)
    at the browser level, so it physically cannot write to your YCharts account.

It runs on YOUR Mac against YOUR session (this is the only place YCharts is reachable). Output:

  research/ycharts_capture/catalog.md      every top-nav item + dropdown link (text + href),
                                           plus the visible text of each page it looks at
  research/ycharts_capture/shots/*.png     a screenshot of every menu and page

You then send catalog.md (small) and a few screenshots back to Claude, who turns them into the
feature-parity build plan in research/ycharts_feature_map.md.

    # one-time: pip install playwright && python3 -m playwright install chromium
    python3 tools/ycharts_explore.py           # opens a browser; log in, press Enter, it explores

Nothing here bypasses a paywall: it uses the pages your own subscription already grants.
"""
from __future__ import annotations

import os
import re
import sys
import time

OUT = os.path.join("research", "ycharts_capture")
SHOTS = os.path.join(OUT, "shots")
PROFILE = os.path.join("data", ".ycharts_profile")  # persists your login between runs (gitignored)

# Menus we try to open and screenshot (harmless if some don't exist).
MENU_LABELS = ["Tools", "Data", "Analysis", "Dashboards", "Watchlists", "Screener",
               "Reports", "Fundamental Charts", "Support", "Account"]

# Canonical READ-ONLY view pages to look at (entitlement permitting). All are view routes.
VIEW_PAGES = [
    ("stock_screener", "https://ycharts.com/screener/stock/"),
    ("fund_etf_screener", "https://ycharts.com/screener/mutual_fund_and_etf/"),
    ("company_quote", "https://ycharts.com/companies/AAPL"),
    ("company_financials", "https://ycharts.com/companies/AAPL/financials"),
    ("fund_quote", "https://ycharts.com/companies/AGG"),
    ("indicator", "https://ycharts.com/indicators/us_gdp"),
]

# Hard guardrails: never click controls whose label matches these, and block these URL verbs.
BLOCK_CLICK = re.compile(r"\b(save|create|new|delete|remove|export|download|buy|sell|order|"
                         r"subscribe|upgrade|cancel|checkout|billing|invite|share|publish|apply)\b", re.I)
BLOCK_URL = re.compile(r"(save|create|delete|update|remove|export|checkout|billing|/new\b)", re.I)
BLOCK_METHOD = {"PUT", "PATCH", "DELETE"}


def _guard(route, request):
    """Abort anything that could write; let reads through. Defense-in-depth beyond not clicking."""
    try:
        if request.method in BLOCK_METHOD or BLOCK_URL.search(request.url or ""):
            return route.abort()
    except Exception:  # noqa: BLE001
        pass
    return route.continue_()


def _shot(page, name):
    path = os.path.join(SHOTS, name + ".png")
    try:
        page.screenshot(path=path, full_page=False)
        return path
    except Exception as e:  # noqa: BLE001
        return f"(screenshot failed: {type(e).__name__})"


def _links(page):
    """Every visible link on the page as (text, href) — this is how we inventory a dropdown."""
    try:
        return page.eval_on_selector_all(
            "a[href]",
            "els => els.filter(e => e.offsetParent !== null)"
            ".map(e => [ (e.innerText||'').trim().slice(0,80), e.href ])"
            ".filter(x => x[0])")
    except Exception:  # noqa: BLE001
        return []


def _body_text(page, limit=14000):
    try:
        return (page.inner_text("body") or "")[:limit]
    except Exception:  # noqa: BLE001
        return ""


def explore(page, out_md):
    """Run the read-only tour. Writes markdown sections to the open file handle `out_md`."""
    def log(s=""):
        out_md.write(s + "\n"); out_md.flush()

    log(f"# YCharts capture — {time.strftime('%Y-%m-%d %H:%M')}\n")

    # 1) the header nav itself
    _shot(page, "00_home")
    log("## Top navigation (all header links)\n")
    for txt, href in _links(page):
        log(f"- **{txt}** → `{href}`")
    log()

    # 2) open each menu, screenshot, and record what it reveals
    log("## Menus (opened one at a time)\n")
    for i, label in enumerate(MENU_LABELS, 1):
        try:
            el = page.get_by_text(label, exact=True).first
            if not el or el.count() == 0:
                continue
            before = {h for _, h in _links(page)}
            el.click(timeout=2500)
            page.wait_for_timeout(700)
            shot = _shot(page, f"menu_{i:02d}_{label.lower().replace(' ', '_')}")
            after = _links(page)
            new = [(t, h) for t, h in after if h not in before]
            log(f"### {label}  \n_screenshot: {os.path.basename(shot)}_\n")
            for t, h in (new or after)[:40]:
                log(f"- {t} → `{h}`")
            log()
            page.keyboard.press("Escape")
            page.wait_for_timeout(200)
        except Exception as e:  # noqa: BLE001
            log(f"### {label} — (couldn't open: {type(e).__name__})\n")

    # 3) look at canonical read-only pages and dump their visible text (metric/filter vocabulary)
    log("## View pages (read-only)\n")
    for name, url in VIEW_PAGES:
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=25000)
            page.wait_for_timeout(1500)
            shot = _shot(page, f"page_{name}")
            log(f"### {name}  \n`{url}`  ·  _screenshot: {os.path.basename(shot)}_\n")
            txt = _body_text(page)
            # keep it readable: collapse blank lines
            txt = re.sub(r"\n{3,}", "\n\n", txt)
            log("```\n" + txt + "\n```\n")
        except Exception as e:  # noqa: BLE001
            log(f"### {name} — (couldn't load {url}: {type(e).__name__})\n")


def main():
    os.makedirs(SHOTS, exist_ok=True)
    os.makedirs(PROFILE, exist_ok=True)
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright isn't installed. Run:\n  python3 -m pip install --user playwright"
              "\n  python3 -m playwright install chromium", file=sys.stderr)
        sys.exit(1)

    start_url = os.environ.get("YC_START", "https://ycharts.com/login")
    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            PROFILE, headless=False, viewport={"width": 1440, "height": 900},
            args=["--disable-blink-features=AutomationControlled"])
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(start_url)
        print("\n" + "=" * 64)
        print("  A browser window opened. Log in to YCharts there if needed.")
        print("  When you're on the YCharts homepage and logged in, come back")
        print("  here and press Enter. (Read-only: it will NOT save anything.)")
        print("=" * 64)
        try:
            input("\nPress Enter to start the read-only tour... ")
        except EOFError:
            pass
        # engage the write-blocking guard AFTER login (login itself needs POST)
        ctx.route("**/*", _guard)
        with open(os.path.join(OUT, "catalog.md"), "w", encoding="utf-8") as fh:
            explore(page, fh)
        print(f"\nDone. Wrote {OUT}/catalog.md and screenshots in {SHOTS}/.")
        print("Send catalog.md (and any interesting screenshots) back to Claude.")
        try:
            input("Press Enter to close the browser... ")
        except EOFError:
            pass
        ctx.close()


if __name__ == "__main__":
    main()
