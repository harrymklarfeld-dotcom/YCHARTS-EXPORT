---
slug: ev-ebitda
title: "EV/EBITDA without the jargon"
summary: Two acronyms, one simple idea — the price of the whole business, debt included, compared with a rough measure of the cash profit it produces.
minutes: 6
level: intermediate
unit: u7-valuation
relatedLessons: [u7-l1, u7-l3]
metrics: [enterprise_value, ev_ebitda, market_cap, d_and_a, operating_income]
tags: [valuation, enterprise-value, ebitda]
updated: 2026-09-25
---

EV/EBITDA sounds like something only bankers say. Strip away the acronyms and it's a very ordinary question: **what would it cost to take over the whole business, and how much operating profit would you get for that price?**

It's popular with professionals for a practical reason: unlike P/E, it isn't thrown off by how much debt a company carries. Let's build it one piece at a time.

## Part one: enterprise value (EV)

Market capitalization, share price × shares, is what the *shares* are worth at the market price. But if you took over the entire company, you'd also take on its debt, and you'd also get its cash. So the price of the whole business is:

> enterprise value = market cap + total debt − cash

Think of purchasing a house for $300,000 that comes with a $100,000 mortgage you must take over and $20,000 of cash left in a safe. Your real cost is $300,000 + $100,000 − $20,000 = $380,000. That's the enterprise value of the house.

```widget:metric ticker=MU metric=enterprise_value
caption="Uses the sample share price in our data; debt and cash are Micron's reported figures."
```

For Micron, debt is larger than cash, so enterprise value is a little *higher* than market cap. For a company sitting on a big net cash pile, EV is *lower* than market cap, because part of what you'd pay for would come straight back as cash.

## Part two: EBITDA

**EBITDA** stands for earnings before interest, taxes, depreciation and amortization. In Tenbagger it's computed simply:

> EBITDA = operating income + depreciation & amortization

- **Before interest**, because EV already accounts for debt. Interest is what debt costs; counting both would double-count.
- **Before taxes**, so companies in different tax situations line up.
- **Before depreciation and amortization**, because these are accounting charges for spending that happened in the past. Adding them back gets closer to the cash the operations produce this year.

Micron's depreciation is large, because it owns huge, expensive factories:

```widget:metric ticker=MU metric=d_and_a
```

## Putting it together

> EV/EBITDA = enterprise value ÷ EBITDA

It reads like a P/E for the whole business: how many years of this year's operating cash profit it would take to pay back the full takeover price.

```widget:compare tickers=MU,COST,KO,PG,MSFT metric=ev_ebitda
caption="All share prices here are sample values; only MU's financials are reported data."
```

## Why professionals like it

- **Debt-neutral.** Two identical businesses, one financed with debt and one without, have very different P/Es (interest lowers the first one's earnings) but similar EV/EBITDA ratios. That makes it better for comparing companies with different balance sheets.
- **Useful when earnings are distorted.** Big depreciation charges, unusual tax years, or heavy interest can push net income around; EBITDA is steadier.
- **It's how acquirers think.** When one company takes over another, it pays for the whole enterprise, debt included.

## The catch: depreciation is a real cost

EBITDA's biggest weakness is the part it leaves out. Depreciation is an accounting charge, but it represents something real: equipment wears out and must be replaced with actual cash. For a software company that barely needs any equipment, ignoring depreciation doesn't change much. For a capital-hungry business like a chip maker, a telecom network or an airline, ignoring it can make the business look far more profitable than it is.

Micron is a good illustration. Its EBITDA is much larger than its operating income, because depreciation is so big. But its capex (the cash actually spent on equipment) is larger still, which is why its free cash flow is only a sliver of EBITDA. For a business like this, EBITDA flatters the picture; **EV ÷ free cash flow** or plain operating income can be more honest.

Other cautions:

- **Cycles still matter.** In a cyclical industry, EBITDA at the peak is temporarily high, so EV/EBITDA looks temporarily low, the same trap as P/E. Average across a cycle.
- **"Adjusted EBITDA."** Companies often publish their own version that adds back more costs (stock compensation, "one-time" charges that recur every year). Use the plain formula.
- **Leases and other debt-like items** can be treated differently between companies, which nudges both EV and EBITDA.

## A quick way to use it

1. Compute EV: market cap + debt − cash.
2. Compute EBITDA: operating income + D&A.
3. Divide, and compare only with similar businesses.
4. Then check capex against D&A. If capex is consistently far above depreciation, EBITDA overstates the cash the business can spare.

## The takeaway

Enterprise value is the price of the whole business, with debt added and cash subtracted. EBITDA is a rough measure of the operating profit that whole business produces before financing and accounting charges. Their ratio compares companies regardless of how they're financed, which is why it's popular. Just remember that depreciation stands in for real future spending, especially in capital-heavy industries.

Practice with real filings:

```widget:quiz lesson=u7-l3
```
