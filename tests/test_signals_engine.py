#!/usr/bin/env python3
"""Offline tests for sentiment, events.assemble, and attribution (OLS + day decomposition)."""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, timedelta
from portfolio import sentiment, events, attribution as attr


# ---- sentiment ----
def test_sentiment_polarity():
    assert sentiment.score("earnings beat, guidance raised")["score"] > 0.3
    assert sentiment.score("stock plunges on weak guidance and downgrade")["score"] < -0.3
    assert abs(sentiment.score("the company held its annual meeting")["score"]) < 0.15
    # negation flips
    assert sentiment.score("not weak")["score"] > 0
    print("ok test_sentiment_polarity")


# ---- events.assemble ----
def _rows(n=200):
    d = date(2023, 1, 1); v = 100.0; out = []
    r = random.Random(1)
    for i in range(n):
        v *= 1 + r.gauss(0.0005, 0.012)
        out.append(((d + timedelta(days=i)).isoformat(), round(v, 2)))
    return out


def test_events_assemble():
    rows = _rows()
    big = rows[100]
    # force a huge move on day 100 so it registers as unusual
    rows[100] = (big[0], rows[99][1] * 1.15)
    earnings = [{"date": rows[100][0], "eps_estimate": 1.0, "eps_actual": 1.3, "surprise_pct": 30.0}]
    news = [{"date": rows[100][0], "title": "Company crushes earnings, raises guidance", "publisher": "X", "link": "u"}]
    tl = events.assemble(rows, earnings=earnings, news=news)
    d = rows[100][0]
    kinds = {e["type"] for e in tl["by_date"][d]}
    assert "earnings" in kinds and "news" in kinds and "move" in kinds, tl["by_date"][d]
    assert tl["day_sentiment"][d] > 0.3, tl["day_sentiment"]
    assert tl["counts"]["earnings"] == 1
    print("ok test_events_assemble")


# ---- attribution OLS ----
def test_ols_recovers_beta():
    R = random.Random(7)
    n = 300
    mkt = [R.gauss(0, 0.01) for _ in range(n)]
    sec = [0.5 * mkt[i] + R.gauss(0, 0.008) for i in range(n)]
    y = [0.0002 + 1.3 * mkt[i] + 0.4 * sec[i] + R.gauss(0, 0.003) for i in range(n)]
    b, r2 = attr._ols(y, [mkt, sec])
    assert abs(b[1] - 1.3) < 0.1 and abs(b[2] - 0.4) < 0.1, b
    assert r2 > 0.8, r2
    print("ok test_ols_recovers_beta")


def test_explain_day_decomposition():
    # build price series so a known day's move = beta*market + residual
    R = random.Random(3)
    d0 = date(2023, 1, 1)
    days = [(d0 + timedelta(days=i)).isoformat() for i in range(260)]
    mret = [R.gauss(0, 0.01) for _ in days]
    sret = [R.gauss(0, 0.01) for _ in days]
    beta = 1.5
    yret = [beta * mret[i] + 0.3 * sret[i] + R.gauss(0, 0.002) for i in range(len(days))]
    # last day: big idiosyncratic residual, no market move
    yret[-1] = 0.08; mret[-1] = 0.0; sret[-1] = 0.0

    def to_px(rets, start=100.0):
        v = start; out = [(days[0], v)]
        for i in range(1, len(days)):
            v *= 1 + rets[i]; out.append((days[i], round(v, 4)))
        return out
    stock, market, sector = to_px(yret), to_px(mret), to_px(sret)
    load = attr.loadings(stock, market, sector)
    assert abs(load["beta_mkt"] - beta) < 0.15, load
    tl = events.assemble(stock)  # no news -> unexplained day
    ex = attr.explain_day(days[-1], stock, market, sector, load, tl)
    assert ex["components_pct"]["market"] == 0.0, ex
    assert ex["components_pct"]["residual"] > 5, ex          # big unexplained move
    assert "unexplained" in ex["classification"], ex["classification"]
    print("ok test_explain_day_decomposition")


def _run():
    for fn in (test_sentiment_polarity, test_events_assemble, test_ols_recovers_beta,
               test_explain_day_decomposition):
        fn()


if __name__ == "__main__":
    _run()
