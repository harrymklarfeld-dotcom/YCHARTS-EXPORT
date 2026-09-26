# Build budget: what it costs to build and launch Tenbagger

Updated 2026-09-26. Two separate costs: **AI usage to write the code** and **real money to launch**.

## 1. AI usage (building with Claude)

Agent token usage reported so far (from each agent's completion report; the lead session's own usage is extra):

| Work | Agents | Tokens (reported) |
|---|---|---|
| Research (market, infra, business, gaps, learning, screeners, benchmarks, strategy, data, money hub, YCharts, design psychology, market map, market entry) | 14 | ~2.3M |
| Build (pipeline, lessons, screener v1/v2, mobile, backend x2, articles, website, funds, monetization, store prep, finance model, money tab, budget) | 15 | ~3.2M |
| Review (QA, contrarian x2, code health) | 4 | ~0.4M |
| **Total reported** | **33** | **~6.0M** (+ 6 agents still running) |

How this is paid depends on your plan: on a Claude subscription it counts against your plan's usage limits
(check claude.ai → Settings → Usage), not a per-token bill. If you ever run this through the API instead,
check current per-token prices before running large fan-outs.

**Rules from here on (to spend less):**
- Max ~3 agents at once, and only for work that is genuinely parallel.
- Standing roles (contrarian, code-health, market-analyst) run on a smaller model (`model: sonnet`).
- No more design fan-outs until you pick a direction; iterate one direction instead.
- Prefer cheap checks (`tenbagger/scripts/check-all.sh --quick`) over full agent reviews after small changes.
- The biggest saver: talk to users before building more features (see `docs/CONTRARIAN.md`).

## 2. Money to launch (cash out of pocket)

| Item | When | Cost | Source |
|---|---|---|---|
| Domain | Now | ~$15–30/yr | LAUNCH_CHECKLIST 0.2 |
| LLC + registered agent | Before App Store | ~$100–800 + state annual fees (e.g. CA $800/yr) | LAUNCH_CHECKLIST 1.1 |
| EIN, D-U-N-S, bank account | Before App Store | $0 | LAUNCH_CHECKLIST 1.2–1.4 |
| Apple Developer (Organization) | Before TestFlight | $99/yr | LAUNCH_CHECKLIST 2.1 |
| Google Play Console | Before Android testing | $25 once | LAUNCH_CHECKLIST 2.2 |
| Supabase (backend) | Beta | $0 free tier → ~$25/mo when you outgrow it | backend/README |
| Expo EAS builds, RevenueCat, AdMob, TestFlight | Beta | $0 on free tiers | LAUNCH_CHECKLIST |
| Plaid bank linking | Only if you keep bank linking | $0 for 10 connections (Trial), then per account | infra research |
| Licensed stock prices | Public launch only | $0 in prototype → ~$250–450/mo | DATA_STRATEGY |
| Claude API for "Ask the screener" | Launch | Small, usage-based; mock mode costs $0 | screener v2 report |
| Lawyer (privacy/terms, trademark, securities review) | Before public launch | ~$1–3k (recommended) + trademark filing ~$700 | LAUNCH_CHECKLIST, finance/assumptions.yaml |

**Totals (estimates):**
- **To test with friends (TestFlight + web):** ~$250–950 (domain, LLC, Apple, Google). Everything else free.
- **To launch publicly and properly:** add ~$1.7–3.7k one-time (lawyer + trademark) and ~$25–475/mo running
  (Supabase + licensed prices), plus Plaid only if bank linking ships.
- **Max cash need in the base-case model:** ~$6.6k over 36 months (finance/out/summary.md).
