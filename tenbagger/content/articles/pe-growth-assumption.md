---
slug: pe-growth-assumption
title: "P/E, and what it quietly assumes about growth"
summary: The price-to-earnings ratio looks like a simple price tag. Flip it over and it becomes a statement about how fast profits need to grow.
minutes: 6
level: intermediate
unit: u7-valuation
relatedLessons: [u7-l2, u7-l5]
metrics: [pe, earnings_yield, eps_diluted, price]
tags: [valuation, pe, growth]
updated: 2026-09-25
---

The **price-to-earnings ratio (P/E)** is the most quoted valuation number in the world:

> P/E = share price ÷ earnings per share

A P/E of 20 means the market price is $20 for every $1 of this year's profit per share. It's easy to compute and easy to compare. It's also easy to misread, because a P/E on its own says nothing about *why* the price is what it is. The interesting part is what the number quietly assumes.

## Flip it over: earnings yield

Turn P/E upside down and you get the **earnings yield**:

> earnings yield = EPS ÷ price = 1 ÷ P/E

A P/E of 20 is an earnings yield of 5%: each $100 of share price comes with $5 of annual profit. A P/E of 50 is a 2% earnings yield. This version is handy because it's in the same units as an interest rate, so you can put it next to a savings account or a bond yield.

Try it. The calculator starts with Micron's reported EPS and the sample share price in our data. Slide either one and watch P/E and earnings yield move in opposite directions:

```widget:calculator kind=pe ticker=MU
caption="EPS is Micron's reported figure; the share price is a sample value, not a live quote."
```

## The hidden assumption

Why would anyone accept a 2% earnings yield when safer places might pay more? Only if they expect the earnings to **grow**. That gives a rough rule of thumb used in the curriculum:

> required return ≈ earnings yield + growth

Rearranged:

> implied growth ≈ required return − earnings yield

Suppose investors as a group want about a 9% yearly return from a stock (a common rough figure for the long-run cost of equity). Then:

- **P/E of 10** → earnings yield 10% → implied growth about **−1%**. The price assumes profits slowly *shrink*.
- **P/E of 15** → yield about 6.7% → implied growth about **2.3%**, roughly inflation.
- **P/E of 30** → yield about 3.3% → implied growth about **5.7% a year, forever**.
- **P/E of 60** → yield about 1.7% → implied growth about **7.3% a year, forever**.

The calculator shows this "implied growth" line live. Slide the price up and watch how much growth the market price is asking for. This is a simplification (it treats growth as steady and perpetual, and treats all earnings as available to owners), but it's a powerful gut check. A high P/E isn't "expensive" or "wrong" by itself; it's a *claim* that profits will grow for a long time. The useful question is whether that claim seems plausible for this business.

## Comparing P/E ratios

```widget:compare tickers=MU,COST,KO,PG,MSFT metric=pe
caption="All share prices in this chart are sample values; only MU's earnings are reported data."
```

When comparing, remember:

- **Growth expectations differ.** A fast-growing software firm and a mature beverage maker shouldn't have the same P/E.
- **Quality differs.** High-ROIC businesses can reinvest profits at attractive rates, so each dollar of growth is worth more.
- **Risk differs.** Steadier earnings typically command a higher P/E than volatile ones.

## Where P/E breaks

P/E is built on one year's earnings, and that's its weak spot.

**Negative or tiny earnings.** A loss makes P/E meaningless; Tenbagger shows it as blank. Near-zero earnings make it enormous without meaning much.

**Cyclical earnings.** This is the big one. In a boom, a cyclical company's earnings are temporarily high, so its P/E looks *low*. At the bottom of a bust, earnings collapse, so its P/E looks sky-high or can't be computed. Counter-intuitively, the P/E of a cyclical company is often lowest near the peak of its profits and highest near the trough. Micron's earnings per share have swung from a loss to well over ten dollars within this decade, so any single-year P/E describes that year, not the business.

For cyclical companies, many analysts use **normalized earnings**: average EPS across a full cycle, and compute P/E against that instead.

**One-off items.** A big gain or write-down distorts the "E". Check whether this year's earnings are representative.

## Earnings yield vs. interest rates

Because earnings yield is a rate, it's often compared with interest rates. When safe rates are high, investors can earn a decent return without risk, so they tend to demand more from stocks, which means lower P/Es. When rates are low, higher P/Es become easier to justify. That's one reason the whole market's P/E drifts over the years even when businesses don't change much.

## The takeaway

P/E is price per dollar of this year's profit. Flipped over, it's an earnings yield. And combined with a required return, it becomes a statement about expected growth. Reading a P/E well means asking: what growth does this price assume, is this year's "E" normal, and how does it compare with similar businesses? The number is a question, not an answer.

Practice with real filings:

```widget:quiz lesson=u7-l5
```
