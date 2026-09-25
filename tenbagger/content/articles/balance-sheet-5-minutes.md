---
slug: balance-sheet-5-minutes
title: "Reading a balance sheet in 5 minutes"
summary: One equation, four questions. How to scan any company's balance sheet for what it owns, what it owes, and whether it can pay its bills.
minutes: 5
level: beginner
unit: u5-balance
relatedLessons: [u5-l1, u5-l3, u5-l4]
metrics: [total_assets, total_liabilities, total_equity, current_ratio, debt_to_equity]
tags: [balance-sheet, basics, debt]
updated: 2026-09-25
---

The income statement is a film: what happened over a year. The **balance sheet** is a photograph: what the company owns and owes on one specific day, the last day of its fiscal year. It looks intimidating, with dozens of lines, but you can get the essential picture in five minutes with one equation and four questions.

## The one equation

Every balance sheet obeys the same identity:

> assets = liabilities + shareholders' equity

- **Assets** are everything the company owns or controls that has value: cash, customer bills not yet paid (receivables), inventory, factories and equipment, patents, and goodwill from past acquisitions.
- **Liabilities** are everything it owes: bills to suppliers, wages due, taxes due, loans and bonds.
- **Shareholders' equity** is what's left over, the owners' claim, sometimes called *book value*.

Equity isn't a pile of money somewhere. It's simply the difference between what the company owns and what it owes. Think of a house worth $400,000 with a $300,000 mortgage: the owner's equity is $100,000.

Here's Micron's, with the subtraction filled in:

```widget:metric ticker=MU metric=total_equity
```

## Question 1: How big is it, and what is it made of?

Start with total assets:

```widget:metric ticker=MU metric=total_assets
```

Then glance at the biggest lines. For Micron, a large share of assets is **property, plant and equipment**: the fabs. For a bank, it would be loans. For a software company, it might be cash and goodwill. The *mix* tells you what kind of business this is and where its risks sit. Heavy physical assets need constant reinvestment; large goodwill means the company grew by acquisitions and paid more than the book value of what it acquired.

## Question 2: Can it pay the bills due this year?

Assets and liabilities are each split into **current** (expected to turn into cash, or come due, within a year) and **non-current** (longer than that). Comparing the two current buckets gives the **current ratio**:

> current ratio = current assets ÷ current liabilities

```widget:metric ticker=MU metric=current_ratio
```

A ratio above 1 means short-term assets cover short-term obligations. Micron's is comfortably above that. But context matters a lot:

```widget:compare tickers=MU,COST,AAPL,MSFT,PG metric=current_ratio
caption="MU is reported data; the others are sample figures."
```

Some very strong businesses run a current ratio near or below 1 *on purpose*. A warehouse retailer, for example, often sells inventory to members before it has to pay suppliers for it; its suppliers are effectively financing the stores. A low current ratio is a reason to look closer, not a verdict.

## Question 3: How much is borrowed?

Find total debt (short-term borrowings plus long-term debt) and compare it with equity:

> debt-to-equity = total debt ÷ shareholders' equity

A debt-to-equity of 0.3 means the company has borrowed 30 cents for every dollar of owners' equity. Higher debt magnifies results in both directions: good years get better for shareholders, bad years get worse, and in a severe downturn, lenders get paid first. For a cyclical business like memory chips, the amount of debt going *into* a downturn matters a great deal. The next article, on net cash vs. net debt, goes deeper.

## Question 4: Is equity growing?

Look at shareholders' equity over several years. Equity grows when the company earns profits and keeps them (retained earnings), and shrinks when it loses money, pays out more than it earns, or repurchases a lot of stock.

A caution: equity can be small, or even negative, at very profitable companies that have spent years returning cash through buybacks. That makes ratios based on equity (like return on equity or price-to-book) look extreme without anything being wrong. Always ask *why* equity is where it is.

## Two traps to avoid

- **Book value isn't market value.** A factory on the balance sheet is recorded at what it cost, minus depreciation, not what it could be sold for. Brands and know-how built in-house barely appear at all. That's why many great companies trade far above book value.
- **It's one day.** Companies know which day the photo is taken. Cash can be unusually high, or debt unusually low, right at year-end. Comparing a few years smooths this out.

## The five-minute checklist

1. **Assets = liabilities + equity.** Find the three totals.
2. **What are the biggest assets?** That tells you the business model.
3. **Current ratio.** Can it cover the next year's bills?
4. **Debt vs. equity (and vs. cash).** How much is borrowed?
5. **Equity trend.** Growing, shrinking, or distorted by buybacks?

## The takeaway

The balance sheet shows what a company has to work with and what claims sit ahead of the owners. You don't need to read every line: the equation, the current ratio and the debt load give you most of what matters, and they tell you how well the company could weather a bad year.

Practice with real filings:

```widget:quiz lesson=u5-l1
```
