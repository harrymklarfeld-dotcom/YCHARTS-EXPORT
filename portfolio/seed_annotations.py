#!/usr/bin/env python3
"""
Reproducible starter set of curated chart-memory notes — the public, well-sourced market events
that give the "Why it moved" charts real narration out of the box. Running this writes them into
data/annotations/ (which is gitignored: your own private notes and buy/sell rationales live there
too and never touch this public repo). These seeds are all public facts, so they ship in the repo
as code and can be regenerated anywhere:

    python -m portfolio.seed_annotations

Add more the same way, or from the dashboard ("✎ Add a note for <day>"), or:
    python -m portfolio.annotations add NVDA 2025-08-27 "FY26 Q2 earnings" "..." --category earnings
"""
from __future__ import annotations

from . import annotations as A

SEEDS = [
    # --- MACRO: these paint on every symbol's chart ---
    dict(scope="MACRO", date="2025-04-02", category="geopolitical", author="claude",
         title="'Liberation Day' tariffs",
         note="Trump announced sweeping tariffs — a 10% baseline on all imports, 34% on China, 25% on "
              "autos, 20% on the EU. The S&P 500 fell ~12% over the next four sessions and shed ~$6.6T, "
              "the largest two-day loss in history.",
         sources=["https://en.wikipedia.org/wiki/2025_stock_market_crash",
                  "https://fortune.com/2025/05/04/stock-market-rebound-sp500-trump-trade-war-liberation-day-tariffs/"]),
    dict(scope="MACRO", date="2025-04-09", category="geopolitical", author="claude",
         title="90-day tariff pause — relief rally",
         note="Trump announced a 90-day pause on most of the new tariffs (China excepted). The S&P 500 "
              "surged +9.52%, its biggest single-day gain since 2008.",
         sources=["https://fortune.com/2025/05/04/stock-market-rebound-sp500-trump-trade-war-liberation-day-tariffs/"]),
    dict(scope="MACRO", date="2025-09-17", category="fed", author="claude",
         title="Fed's first 2025 cut (-25bps)",
         note="The FOMC cut the funds rate 25bps to a 4.00-4.25% range — the first cut since Dec 2024 — "
              "citing slowing job gains. It projected two more cuts for 2025.",
         sources=["https://www.federalreserve.gov/newsevents/pressreleases/monetary20250917a.htm",
                  "https://www.cbsnews.com/news/federal-reserve-fomc-meeting-today-rate-cut-september-2025-powell-impact/"]),
    # --- NVDA: security-specific ---
    dict(scope="NVDA", date="2025-01-27", category="product", author="claude",
         title="DeepSeek shock — worst day ever",
         note="China's DeepSeek released a competitive AI model trained for a fraction of the usual cost, "
              "raising fears that GPU demand is overbuilt. NVDA fell ~17% to $118.58 and lost ~$589B of "
              "market cap in one day — the largest single-day value wipeout of any company in history.",
         sources=["https://www.cnbc.com/2025/01/27/nvidia-sheds-almost-600-billion-in-market-cap-biggest-drop-ever.html",
                  "https://www.forbes.com/sites/dereksaul/2025/01/27/biggest-market-loss-in-history-nvidia-stock-sheds-nearly-600-billion-as-deepseek-shakes-ai-darling/"]),
    dict(scope="NVDA", date="2025-04-09", category="regulatory", author="claude",
         title="US requires license for H20 China exports",
         note="Washington told NVDA it needs an export license to sell H20 chips to China (made indefinite "
              "on Apr 14). NVDA took a $4.5B charge in Q1 FY26 for excess H20 inventory and purchase obligations.",
         sources=["https://www.sec.gov/Archives/edgar/data/1045810/000104581025000082/nvda-20250409.htm",
                  "https://globaltradealert.org/state-act/91360-united-states-government-imposes-indefinite-export-license-requirement-on-nvidia-h20-chips-to-china-and-d5-countries"]),
]


def main(argv=None):
    n = 0
    for s in SEEDS:
        rec = A.add(s)
        print(f"seeded {rec['scope']:6} {rec['date']}  {rec['title']}")
        n += 1
    print(f"\n{n} notes written to {A.STORE}/  (MACRO: {len(A.load('MACRO'))}, NVDA: {len(A.load('NVDA'))})")


if __name__ == "__main__":
    main()
