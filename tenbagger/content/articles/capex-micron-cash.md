---
slug: capex-micron-cash
title: "Capex, and why Micron's cash swings"
summary: Capital expenditure is the cost of staying in the game. In chip-making it is enormous, lumpy and badly timed — which is why Micron's free cash flow swings so much harder than its sales.
minutes: 6
level: intermediate
unit: u4-cashflow
relatedLessons: [u4-l4, u4-l2, u4-l1]
metrics: [capex, operating_cash_flow, free_cash_flow, d_and_a]
tags: [cash-flow, capex, cycles, micron]
updated: 2026-09-25
---

**Capital expenditure**, or *capex*, is the cash a company spends on long-lived physical assets: factories, machines, buildings, servers. It shows up on the cash flow statement under investing activities, and it's the piece subtracted from operating cash flow to get free cash flow.

For many businesses, capex is a modest, steady bill. For a memory-chip maker, it's the defining feature of the business. This article uses Micron's real numbers to show why.

## How big is the bill?

Here's what Micron spent on capex in its latest fiscal year:

```widget:metric ticker=MU metric=capex
```

And here's the cash its operations brought in over the same year:

```widget:metric ticker=MU metric=operating_cash_flow
```

Put those side by side and the story is stark: roughly nine out of every ten dollars of operating cash went straight back into plant and equipment. Measured against sales, capex was over 40 cents per revenue dollar. Compare that with a typical software company, where capex might be a few cents per dollar, or a retailer, where it's usually well under ten.

That ratio (capex ÷ revenue) is called **capex intensity**, and it's one of the most useful numbers for understanding how a business works.

## Why chip-making eats so much capital

Memory chips are made in fabrication plants ("fabs") that cost many billions of dollars each and are packed with some of the most expensive machinery on earth. Three features make the spending relentless:

1. **Technology treadmill.** Every generation of memory packs more bits into the same space. A company that stops upgrading falls behind on cost per bit within a couple of years, and in a commodity-like product, cost is survival.
2. **Scale.** A fab only makes sense running near full capacity; its costs are mostly fixed. So capacity comes in big, indivisible chunks.
3. **Long lead times.** A new fab takes years to plan, build and ramp. Decisions made in a boom arrive as supply years later, often into a bust.

## Depreciation vs. capex

On the income statement, those huge purchases don't appear all at once. They're spread over the equipment's useful life as **depreciation**. That creates a gap between profit and cash:

- When capex is **above** depreciation, the company is expanding or upgrading faster than its assets wear out. Free cash flow will look weak relative to profit.
- When capex is **below** depreciation, the company is harvesting: free cash flow looks strong relative to profit, but that can't last if the equipment isn't replaced.

In Micron's latest year, capex ran at nearly twice depreciation and amortization, a sign of heavy investment. That's why its net income was several times its free cash flow.

## The cycle, in two charts

Revenue in memory rises and falls with prices, which depend on the balance of supply and demand across the industry:

```widget:history ticker=MU metric=revenue
```

Now look at free cash flow over the same years:

```widget:history ticker=MU metric=free_cash_flow average=true
```

The free cash flow chart swings much harder than revenue, in both directions. Here's why. Capex can't be switched on and off as fast as prices move. Commitments for equipment are made quarters or years ahead, and cutting investment too deeply risks losing the technology race. So when prices fall:

- Revenue drops sharply.
- Operating cash flow drops even more, because costs are largely fixed.
- Capex falls, but slowly and only partly.
- **Free cash flow, the small difference between two big numbers, collapses**, sometimes below zero, as it did in fiscal 2023.

In a boom the reverse happens: prices jump, operating cash floods in, capex lags, and free cash flow spikes.

This is a general rule worth remembering: **when a small number is the difference between two big numbers, small changes in either one cause huge swings in the result.** That's true of free cash flow in capital-intensive businesses, and it's true of profit in any business with high fixed costs.

## What this means when reading the numbers

- **Don't judge a capital-intensive company by one year's FCF.** Micron's history shows years of strong free cash and years of heavy losses. The dashed average line is a fairer description of the business than any single bar.
- **Watch capex relative to depreciation.** It tells you whether the company is in an investment phase or a harvesting phase.
- **Ask where in the cycle the latest year sits.** High margins and high cash flow in a cyclical business often reflect tight supply that tends to attract new capacity, from the company itself and its competitors.
- **Capex isn't waste.** In a technology race, the company that under-invests in a downturn may come out of it with a cost disadvantage. Heavy spending at the bottom can be a sign of strength, if the balance sheet can carry it.

## The takeaway

Capex is the price of staying competitive, and in memory chips it's a very large price paid in lumpy, hard-to-time installments. Because free cash flow is the thin slice left between large operating cash flow and large capex, it amplifies the industry cycle. Reading a chip maker's cash flow means reading across the whole cycle, not one year of it.

Practice capex intensity on real filings:

```widget:quiz lesson=u4-l4
```
