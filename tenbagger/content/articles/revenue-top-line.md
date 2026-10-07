---
slug: revenue-top-line
title: "Revenue is the top line — and why it's not profit"
summary: What revenue measures, why it sits at the top of the income statement, and the three questions to ask before being impressed by a big number.
minutes: 5
level: beginner
unit: u1-revenue
relatedLessons: [u1-l1, u1-l2, u1-l3]
metrics: [revenue, revenue_growth_yoy, revenue_cagr_3y]
tags: [income-statement, basics, growth]
updated: 2026-09-25
---

Every annual report opens its income statement with the same line: revenue. It is the total amount customers paid the company during the fiscal year for whatever it makes or does. Analysts call it the **top line** for a boring reason: it is literally the first line. Everything below it is something being subtracted.

That position is the whole lesson. Revenue is where the money *starts*, not where it ends up.

## What revenue actually counts

Revenue counts sales that were *earned* in the period. A memory-chip maker books revenue when chips ship to a customer. A warehouse club books it when members check out, plus a membership fee spread over the year. A software company that bills a three-year contract up front books only one year's share as revenue each year; the rest waits on the balance sheet.

Here is Micron's top line for its most recent fiscal year, straight from its reported numbers:

```widget:metric ticker=MU metric=revenue
```

That is a big number. It tells you Micron is a large business. It tells you nothing yet about whether Micron kept any of it.

## Why revenue is not profit

Imagine a lemonade stand that takes in $100 on a hot Saturday. That $100 is revenue. Now subtract the lemons, sugar and cups ($40), the rented table ($10), and the helper's wages ($30). What's left, $20, is closer to profit. Same stand, same $100 of revenue, but a very different story depending on the costs.

Real companies work the same way, just with more lines:

1. **Revenue** — what customers paid.
2. minus **cost of revenue** — the direct cost of making the product.
3. = **gross profit**.
4. minus operating costs (salaries, research, marketing, rent).
5. = **operating income**.
6. minus interest and taxes.
7. = **net income**, the bottom line.

Two companies with identical revenue can end up with wildly different bottom lines. A grocer and a software firm might each bring in $50 billion a year; one keeps a few cents per dollar, the other keeps a third. Revenue alone cannot tell them apart.

## Size is not the same as quality

Because revenue is the biggest, easiest number to find, it gets quoted constantly. Here is how a few well-known companies compare on the top line:

```widget:compare tickers=MU,COST,MSFT,AAPL metric=revenue
caption="COST, MSFT and AAPL are sample data; MU is Micron's reported figure."
```

Notice what this chart can and cannot say. It shows scale: how much business flows through each company. It does not show which one is more profitable, which one uses less capital, or which one is growing faster. Those need other numbers, and the rest of this library walks through them one at a time.

## Revenue over time tells a better story

A single year of revenue is a snapshot. A decade is a film. Micron's history is a good example of why the film matters:

```widget:history ticker=MU metric=revenue
```

Look at the shape. Revenue more than doubled between fiscal 2016 and 2018, fell for two years, climbed again, then roughly halved in fiscal 2023 before rebounding to a record. Memory chips are a *cyclical* business: when supply is tight, prices jump and revenue soars; when factories catch up, prices fall and revenue drops, even though the company is selling similar products to similar customers.

That is why you'll see two growth measures in Tenbagger:

- **Revenue growth (1 year)** = this year's revenue ÷ last year's − 1. Fast, but noisy. One great or terrible year distorts it.
- **3-year CAGR** (compound annual growth rate) = (revenue now ÷ revenue three years ago)^(1/3) − 1. It smooths the bumps into one steady yearly rate.

For Micron, the one-year number and the three-year number tell very different stories, and neither is "the" answer. The one-year figure reflects a sharp recovery from a bad year; the three-year figure compares against a year near the previous peak. When you see a dramatic growth number, always ask *compared to when?*

## Three questions before being impressed by revenue

1. **Is it growing, and from what base?** Growth from a trough looks spectacular; growth from a peak looks sluggish. Check a few years, not one.
2. **How much of it does the company keep?** That is the margin question, and it's the next article.
3. **Is it repeatable?** Subscription and membership revenue tends to recur. One-off contracts and commodity-like products swing with the cycle.

## The takeaway

Revenue measures how much customers were willing to pay. It is the raw material for every other number on the income statement, and it's the one line that's hardest to fake over long periods, because someone actually handed over money. But it is only the beginning. A company can grow revenue for years and still never make money, if the cost of each sale is higher than the price.

Try the lesson to practice reading revenue and computing growth from real filings:

```widget:quiz lesson=u1-l1
```
