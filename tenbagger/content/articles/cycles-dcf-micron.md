---
slug: cycles-dcf-micron
title: "Cycles: why one DCF can mislead (the Micron case)"
summary: A DCF multiplies whatever you feed it. Feed it a peak year from a cyclical business and it will confidently multiply the peak. Micron's real decade of numbers shows how far off that can be.
minutes: 7
level: advanced
unit: u8-intrinsic
relatedLessons: [u8-l4, u8-l3, u8-l1]
metrics: [free_cash_flow, gross_margin, revenue, net_cash]
tags: [dcf, cycles, micron, valuation]
updated: 2026-09-25
---

A discounted cash flow estimate is a machine that multiplies. You give it a starting free cash flow, and after growth, discounting and a terminal multiple, you get back something like fifteen to twenty times that starting number. That's fine when the starting number is representative of the business. It's a serious problem when it isn't.

In a **cyclical** business (one whose profits rise and fall with an industry-wide cycle), any single year's cash flow is a snapshot of a moment in the cycle, not a description of the business. Micron, a memory-chip maker, is a textbook example, and this article uses its real reported numbers.

## A decade of swings

Start with gross margin, the share of each sales dollar left after the cost of making the chips:

```widget:history ticker=MU metric=gross_margin average=true
```

In the same company, making the same kind of product, gross margin has ranged from well over half of revenue to below zero. Memory is a product where one company's chip is broadly interchangeable with another's, so prices are set by industry-wide supply and demand. When supply is tight, prices soar and nearly all of the extra revenue drops to profit, because a fab's costs are largely fixed. When the industry adds too much capacity, prices fall below the cost of production.

Now free cash flow, which amplifies these swings because capex doesn't fall as fast as revenue:

```widget:history ticker=MU metric=free_cash_flow average=true
```

The best year in this window, fiscal 2018, produced about $8.5 billion of free cash flow. Fiscal 2023 burned more than $6 billion. The dashed line is the average across all ten years: about $1.4 billion. The peak year was roughly six times the average.

## The peak-year DCF

Imagine sitting at the end of fiscal 2018, looking at a record year and running a DCF that starts from that year's free cash flow. The calculator below does exactly that: it's prefilled with Micron's fiscal 2018 free cash flow and today's net debt and share count.

Now flip the **Cyclical: use normalized FCF** switch. It swaps the starting point for the ten-year average and leaves every other assumption alone:

```widget:calculator kind=dcf ticker=MU fcf=8521000000
caption="Starts from Micron's FY2018 peak free cash flow. The toggle swaps in the 10-year average."
```

Same growth rate, same discount rate, same terminal multiple, and an estimate several times smaller. Nothing about the method changed. Only the starting number did. That's the core problem: **a DCF on a peak year quietly assumes the peak is the new normal, and then capitalizes it forever.**

It works in reverse, too. Start from a trough year like fiscal 2023 and the DCF says the business is worth less than nothing, which is equally absurd for a company that went on to post record revenue two years later.

## What normalizing means

**Normalizing** replaces one year's number with an estimate of what the business earns in a typical year across a full cycle. The simplest version is the one the calculator uses: the average of the last ten years of free cash flow. Other common approaches:

- **Average margin × current revenue.** Apply a through-cycle average FCF margin to today's sales, which adjusts for the business being bigger than it was a decade ago.
- **Mid-cycle estimate.** Pick a year you judge to be neither boom nor bust.
- **Scenario range.** Run the DCF three times (trough, average, peak) and look at the spread rather than a single number.

Each has flaws. A ten-year average of a growing company understates today's scale; an average margin assumes the industry's structure hasn't changed. But all of them are more honest than a single extreme year.

## Signs you're looking at a cyclical

You don't need to be a semiconductor expert to recognize the pattern. Warning signs:

1. **Margins that swing widely** from year to year, well beyond what a normal business shows.
2. **A commodity-like product** where customers switch suppliers on price.
3. **Heavy fixed costs and large, lumpy capex**, so capacity arrives in big steps.
4. **Industry-wide booms and busts** that hit every competitor at once.
5. **P/E that looks lowest when profits are highest.** At the peak, earnings are inflated, so the ratio looks modest; at the trough, earnings collapse and the P/E looks enormous or disappears.

Memory chips tick every box. So do many parts of energy, chemicals, steel, shipping, homebuilding and airlines.

## Reading the latest year

Micron's latest fiscal year had record revenue, but its free cash flow was modest, because it spent almost all of its operating cash on new equipment. So even "which number is the peak?" isn't simple: profit and cash can peak at different times. That's another reason to look at the whole history, and at more than one metric, before trusting any single-year estimate.

## The takeaway

A DCF is only as good as the cash flow you start from. In a cyclical business, one year is a point on a wave, and capitalizing the crest (or the trough) produces an estimate that can be off by multiples. Look at the full cycle, normalize the starting point, run a range of scenarios, and treat the result as a sense of scale rather than a precise answer.

Practice with Micron's real numbers:

```widget:quiz lesson=u8-l4
```
