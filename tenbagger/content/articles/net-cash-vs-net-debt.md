---
slug: net-cash-vs-net-debt
title: "Net cash vs. net debt"
summary: One subtraction — cash minus debt — tells you whether a company could pay off every loan today, and how much room it has when a bad year arrives.
minutes: 5
level: beginner
unit: u5-balance
relatedLessons: [u5-l2, u5-l3]
metrics: [net_cash, cash, total_debt, debt_to_equity]
tags: [balance-sheet, debt, cash]
updated: 2026-09-25
---

"This company has $15 billion of debt" sounds alarming. "This company has $15 billion of debt and $20 billion of cash" sounds very different. Debt on its own is half a sentence. The other half is the cash sitting next to it.

## The formula

> net cash = cash − total debt

- If the result is **positive**, the company has **net cash**: it could repay every loan and bond from its bank account today and still have money left.
- If it's **negative**, the company has **net debt**: even after using all its cash, some borrowing would remain.

"Cash" here includes cash equivalents and short-term investments that can be turned into cash quickly. "Total debt" is short-term borrowings plus long-term debt: loans and bonds that charge interest. It doesn't include things like bills owed to suppliers.

Here's Micron, from its reported balance sheet:

```widget:metric ticker=MU metric=net_cash
```

Negative: Micron has net debt. That's a fact, not a judgment. Whether it's a comfortable amount depends on what comes next.

## Why this one number matters

**Resilience.** A company with net cash can ride out a terrible year, even several, without asking anyone for money. It can keep investing when competitors are cutting back. A company with heavy net debt must keep paying interest and eventually repay or refinance, whatever the business is doing.

**Valuation.** When you value a whole business, the owners get what's left after lenders are paid. That's why **enterprise value** adds debt and subtracts cash from market cap, and why a DCF estimate adds net cash (or subtracts net debt) at the end. Two companies producing the same cash flows are worth different amounts to shareholders if one has a war chest and the other a mortgage.

**Flexibility.** Net cash is optionality: acquisitions, buybacks, dividends, or simply patience.

## Comparing companies

```widget:compare tickers=MU,COST,AAPL,AMZN,KO metric=net_cash
caption="MU is reported data; COST, AAPL, AMZN and KO are sample figures."
```

Bars to the right of zero are net cash; bars to the left are net debt. Notice that net debt shows up at some of the most stable, profitable companies in the world. That's not a contradiction. A business with very predictable cash flows (a beverage brand, a consumer staples giant) can safely carry more debt than one whose profits swing, because lenders and managers can be confident the interest will be covered. Some companies borrow deliberately to fund buybacks and dividends.

So the right question isn't "is there debt?" but "**is the debt sized for how volatile this business is?**"

## Net debt in a cyclical business

For a cyclical company the timing of debt matters as much as the amount. Watch how Micron's debt and cash moved over the past decade:

```widget:history ticker=MU metric=total_debt
```

```widget:history ticker=MU metric=cash
```

At the top of the fiscal 2018 boom, Micron's cash exceeded its debt: it had net cash. Debt then drifted up for several years, and jumped in fiscal 2023, the downturn year when free cash flow went deeply negative. That's the pattern to understand: cyclical companies tend to *borrow in the bust*, when cash flow disappears but investment can't stop, and pay down in the boom. Net debt at the peak of a cycle is a warning worth taking seriously; net debt at the trough may be the natural result of the cycle doing what cycles do.

## Pairing net cash with other measures

Net cash is a snapshot. Two related measures add depth:

- **Debt-to-equity** (total debt ÷ shareholders' equity) sizes debt against the owners' stake.
- **Debt vs. earnings or cash flow**: how many years of operating profit or free cash flow it would take to repay the net debt. Two years is very different from ten. (Analysts often use net debt ÷ EBITDA; the EV/EBITDA article explains EBITDA.)

And one caution: some obligations behave like debt without being labeled as such, for example long-term leases or pension shortfalls. For a first look, cash minus debt is enough; for a deeper look, check the notes.

## The takeaway

Net cash is one subtraction that tells you how much financial cushion a company has. Positive means it could clear all its borrowing today; negative means lenders have a claim ahead of shareholders. Neither is good or bad on its own. What matters is how the debt compares with the stability of the cash flows that must service it, and where in its cycle the company is borrowing.

Practice with real filings:

```widget:quiz lesson=u5-l2
```
