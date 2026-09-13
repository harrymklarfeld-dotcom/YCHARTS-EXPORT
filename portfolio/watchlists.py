#!/usr/bin/env python3
"""
Named watchlists the research engine tracks. One source of truth shared by the YCharts
pull (ycharts_export.api), the dashboard Compare tab, and the (coming) research agents.

The S&L model portfolio is Aaron's 10-ETF all-weather sleeve. Each entry is tagged by the
job it does and its rough correlation to the S&P 500, which is what makes it useful as a
hedge overlay on a tech-heavy book.

    python -m portfolio.watchlists sl_model      # print the tickers
"""
from __future__ import annotations

import json
import os
import sys

# sleeve: growth (moves with / more than S&P) | thematic (sector cycle) | diversifier (low S&P correlation)
SL_MODEL = [
    {"ticker": "QDPL", "name": "Pacer Metaurus US Large Cap Dividend Multiplier 400", "sleeve": "growth",
     "role": "S&P 500 with 4x dividend yield, ~89% price participation", "sp_corr": "high", "issuer": "Pacer"},
    {"ticker": "QQQ", "name": "Invesco QQQ (Nasdaq-100)", "sleeve": "growth",
     "role": "big-cap tech/growth", "sp_corr": "high", "issuer": "Invesco"},
    {"ticker": "SMH", "name": "VanEck Semiconductor", "sleeve": "growth",
     "role": "semiconductors, high beta cyclical", "sp_corr": "high", "issuer": "VanEck"},
    {"ticker": "PATN", "name": "Pacer Nasdaq International Patent Leaders", "sleeve": "growth",
     "role": "ex-US growth by patent value (TSMC, Samsung, SK Hynix, ASML)", "sp_corr": "med-high", "issuer": "Pacer"},
    {"ticker": "IAI", "name": "iShares US Broker-Dealers & Securities Exchanges", "sleeve": "thematic",
     "role": "capital-markets / financials factor", "sp_corr": "med-high", "issuer": "iShares"},
    {"ticker": "XAR", "name": "SPDR S&P Aerospace & Defense", "sleeve": "thematic",
     "role": "aerospace & defense, secular tailwind", "sp_corr": "medium", "issuer": "SPDR"},
    {"ticker": "PAVE", "name": "Global X US Infrastructure Development", "sleeve": "thematic",
     "role": "infrastructure / reshoring; IIJA expiry is a 2026 headwind", "sp_corr": "medium", "issuer": "Global X"},
    {"ticker": "USAI", "name": "Pacer American Energy Independence", "sleeve": "diversifier",
     "role": "midstream energy infrastructure / MLPs, income + inflation", "sp_corr": "low", "issuer": "Pacer"},
    {"ticker": "SDCI", "name": "USCF SummerHaven Dynamic Commodity (No K-1)", "sleeve": "diversifier",
     "role": "broad commodities, true low/negative S&P correlation", "sp_corr": "low", "issuer": "USCF"},
    {"ticker": "USFR", "name": "WisdomTree Floating Rate Treasury", "sleeve": "diversifier",
     "role": "floating-rate T-bills, cash-like ~0 beta, dry powder", "sp_corr": "none", "issuer": "WisdomTree"},
]

MODEL_PORTFOLIOS = {
    "de_risk": {"label": "De-Risk (conservative hedge)", "beta": 0.75,
                "weights": {"VOO":48,"AAPL":6,"NVDA":6,"MU":4,"XLV":5,"XLE":3,"SDCI":8,"USFR":8,"GLD":6,"USAI":3,"CASH":3}},
    "barbell":  {"label": "Barbell (balanced, recommended)", "beta": 0.90,
                "weights": {"VOO":46,"NVDA":9,"AAPL":8,"MU":6,"XAR":5,"PATN":4,"IAI":3,"XLV":5,"XLE":3,"SDCI":5,"USFR":3,"GLD":3}},
    "growth_dc": {"label": "Growth, de-concentrated (aggressive)", "beta": 1.05,
                "weights": {"VOO":40,"NVDA":11,"MU":8,"AAPL":7,"QQQ":4,"PATN":6,"XAR":5,"IAI":4,"PAVE":3,"XLV":3,"SDCI":5,"USFR":4}},
}

SEMI = {"MU","NVDA","AVGO","SMH"}
TRUE_HEDGE = {"SDCI","USFR","GLD","USAI"}


def model_exposures(name):
    w = MODEL_PORTFOLIOS[name]["weights"]
    return {"semi": sum(v for k,v in w.items() if k in SEMI),
            "hedge": sum(v for k,v in w.items() if k in TRUE_HEDGE),
            "core": w.get("VOO",0)}


WATCHLISTS = {
    "sl_model": SL_MODEL,
    "sl_model_tickers": [x["ticker"] for x in SL_MODEL],
}


def tickers(name: str = "sl_model") -> list[str]:
    wl = WATCHLISTS.get(name, [])
    return [x["ticker"] if isinstance(x, dict) else x for x in wl]


def load_user(name: str, path="config/watchlists.json") -> list[str]:
    """User-defined watchlists live in config/watchlists.json: {name: ["AAA","BBB"]}."""
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        if name in data:
            return data[name]
    return tickers(name)


if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else "sl_model"
    print("\n".join(tickers(name)))
