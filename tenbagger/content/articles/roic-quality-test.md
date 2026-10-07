---
slug: roic-quality-test
title: "ROIC: the quality test"
summary: Return on invested capital asks the question that separates great businesses from merely big ones — how much profit does each dollar put into the business produce?
minutes: 6
level: intermediate
unit: u6-returns
relatedLessons: [u6-l3, u6-l1, u6-l4]
metrics: [roic, roe, operating_income, total_equity, total_debt]
tags: [returns, quality, roic]
updated: 2026-09-25
---

Imagine two coffee shops, each earning $50,000 a year. The first cost $100,000 to open; the second cost $1,000,000. Same profit, very different businesses. The first returns 50% a year on the money put into it; the second returns 5%, less than a savings account in some years. If each wanted to open a second location, the first would create far more value with every dollar.

That's the idea behind **return on invested capital (ROIC)**: profit measured against the money it took to produce it. It's one of the most widely used "quality" tests in investing, because it captures something revenue and margins can't: *how efficiently a business turns capital into profit.*

## The formula

> ROIC = operating income × (1 − tax rate) ÷ (total debt + shareholders' equity − cash)

Two parts:

- **The top, NOPAT** (net operating profit after tax), is operating income with a normal tax bill taken out. It deliberately ignores interest, so the result doesn't depend on how the company is financed. Tenbagger uses the company's own effective tax rate, capped between 0% and 35%, or 21% if it can't be computed.
- **The bottom, invested capital**, is all the money lenders and owners have put into the business (debt plus equity), minus cash that's sitting idle rather than working.

Here is Micron's, from its reported numbers:

```widget:metric ticker=MU metric=roic
```

## How to read it

A useful benchmark is the company's **cost of capital**, roughly the return that lenders and owners together expect for the risk they're taking. For large companies that's often somewhere around 8% to 10%.

- **ROIC well above the cost of capital**: each dollar reinvested creates more than a dollar of value. Growth is valuable.
- **ROIC near the cost of capital**: growth adds size but not much value.
- **ROIC below the cost of capital**: growth can actually *destroy* value, because each new dollar invested earns less than it costs.

That's the real power of ROIC. It tells you whether growth is worth having.

## Comparing companies

```widget:compare tickers=MU,COST,AAPL,MSFT,KO metric=roic
caption="MU is reported data; COST, AAPL, MSFT and KO are sample figures."
```

Look at the variety of ways to earn a high return:

- **A warehouse retailer** has razor-thin margins, but turns its inventory and stores over so fast that each dollar of capital supports many dollars of sales. Thin margin × high turnover can equal a high ROIC.
- **A hardware brand that outsources manufacturing** needs relatively little capital of its own, so a moderate margin on enormous sales produces a very high ROIC.
- **A software company** has high margins *and* low capital needs.
- **A chip maker** has to own its factories, which ties up a lot of capital. Its ROIC depends heavily on where the cycle is: very high at the peak, negative at the trough.

This decomposition is worth remembering: **ROIC ≈ margin × capital turnover**. You can get there with a fat margin, with fast turnover, or with both.

## Why not just use ROE?

Return on equity (net income ÷ shareholders' equity) is more commonly quoted, and it's useful. But it has a blind spot: **debt and buybacks inflate it.** Borrow money, use it to repurchase shares, and equity shrinks while profit barely changes, so ROE rises even though the business is no better.

```widget:compare tickers=MU,COST,AAPL,KO metric=roe
caption="MU is reported data; the others are sample figures."
```

Compare this chart with the ROIC chart above. Companies that have returned large amounts of cash through buybacks, or that carry significant debt, can show ROE far above their ROIC. ROIC counts debt *and* equity in the denominator, so it isn't fooled by the financing mix. When the two numbers diverge sharply, leverage or buybacks are usually the reason.

## Pitfalls

- **One year can mislead.** In cyclical industries, ROIC at the peak describes the peak. Average it across a cycle.
- **Accounting shapes the denominator.** Years of write-downs or large buybacks can shrink invested capital and inflate ROIC; big acquisitions add goodwill and depress it.
- **Growth investment looks bad at first.** A company building new capacity carries the capital before the profit arrives.
- **Definitions vary.** Different data providers compute ROIC differently (tax rates, whether to subtract cash, lease adjustments). Compare numbers from the same source, like the formula shown in the widget.

## The takeaway

ROIC asks how much after-tax operating profit each dollar of invested capital produces. Compared with the cost of capital, it tells you whether growth creates value. It rewards businesses that need little capital or turn it over quickly, and it isn't flattered by debt the way ROE can be. For a single number that says "this is a good business," it's hard to beat, as long as you read it across more than one year.

Practice with real filings:

```widget:quiz lesson=u6-l3
```
