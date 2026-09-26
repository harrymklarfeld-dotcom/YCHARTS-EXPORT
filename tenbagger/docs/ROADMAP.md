# Tenbagger roadmap and decision log

The single page for "what are we building, what's next, what was decided". Update it whenever a decision is made.
Working name: Tenbagger (rename decision pending, see D-03).

## Now (this 2 weeks)

| # | Item | Owner | Done when |
|---|---|---|---|
| N1 | Customer interviews (15–20 students) using `discovery/INTERVIEW_GUIDE.md` | Founder | 15 logged in `discovery/tracker.csv` by Oct 12 |
| N2 | Connect the waitlist form to a real endpoint and run the Learn vs Money headline test | Founder + build | Sign-ups captured; ≥150 visitors per headline |
| N3 | Pick a design direction from the v2 prototypes | Founder | Direction chosen; design-lead applies tokens |
| N4 | Integrate finished modules into the app (Money dashboard tabs, budget, monetization gates, articles) | Build | `scripts/check-all.sh` green; one click-through test passes |
| N5 | Publish the working web app + pitch page | Build | Links shared with founder |

## Next (before friends test on TestFlight)

- Analytics (PostHog) for D1/D7 retention; crash reporting (Sentry).
- Real SEC data: add `SEC_USER_AGENT` secret so the nightly job replaces sample companies.
- Founder setup: domain, LLC, D-U-N-S, Apple Developer ($99), Google Play ($25). See `docs/LAUNCH_CHECKLIST.md`.
- Private founder profile (git-ignored) so the budget shows real numbers in dev.

## Later (only if the day-28 / day-77 gates pass)

- Bank linking via Plaid (Trial), Supabase deploy, licensed price feed.
- Recruiting Pass / interview-prep track; campus club pilot.
- Security review, accessibility audit, release manager automation.

## Gates (from MARKET_ENTRY / PRODUCT_STRATEGY)

- **Day 28 (2026-10-26):** ≥60% of a segment rate pain ≥4/5 in interviews; ≥10% warm / ≥4% cold sign-up; ≥5% reserve paid plan.
- **Day 77:** TestFlight cohort D1 ≥35%, D7 ≥15%. D7 <10% → pivot to interview-prep only.
- **Day 90:** D30 <5% → stop.

## Decision log

| ID | Date | Decision | Status | Why / source |
|---|---|---|---|---|
| D-01 | 2026-09-25 | Build lessons + screener on SEC data first; brokerage linking read-only and later | Decided | docs/PRODUCT_STRATEGY.md, MARKET_ENTRY.md |
| D-02 | 2026-09-25 | Subscription is the core model; ads/affiliate are supplements; never cash advances or credit offers | Decided | BENCHMARKS.md, MONEY_HUB_RESEARCH.md |
| D-03 | 2026-09-25 | Retire "Tenbagger" as public name? (existing Android app; promises 10x) | **Open: founder** | CONTRARIAN.md #2, PRODUCT_STRATEGY §3 |
| D-04 | 2026-09-25 | Keep the money hub in v1, or ship it as an experiment | **Open: founder** | CONTRARIAN.md #3 |
| D-05 | 2026-09-25 | Plaid in beta vs manual due-date check only | **Open: founder** | CONTRARIAN.md #4 |
| D-06 | 2026-09-25 | Keep ads + hearts, or cut them and add a $49 Recruiting Pass | **Open: founder** | CONTRARIAN.md #5 |
| D-07 | 2026-09-26 | Budget: 4-input quick setup is the default; full plan optional; no faked insights | Decided | CONTRARIAN.md (budgeting review) |
| D-08 | 2026-09-26 | Real personal data never enters git (`private/`, `*.local.json` ignored) | Decided | privacy rule |
| D-09 | 2026-09-26 | Max ~3 concurrent agents; standing reviewers on a smaller model | Decided | docs/BUILD_BUDGET.md |
