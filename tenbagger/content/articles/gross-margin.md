---
slug: gross-margin
title: "Gross margin: what a company keeps"
summary: The first cut of profit — what's left of each sales dollar after paying for the product itself — and why it says so much about a business model.
minutes: 5
level: beginner
unit: u2-margins
relatedLessons: [u2-l1]
metrics: [gross_margin, gross_profit, cost_of_revenue]
tags: [margins, income-statement, basics]
updated: 2026-09-25
---

Revenue tells you how much customers paid. **Gross margin** tells you how much of each of those dollars was left after paying for the thing that was sold. It is the first and, in many ways, the most revealing cut of profit.

## The formula

Start with two numbers from the income statement:

- **Revenue** — what customers paid.
- **Cost of revenue** (also called cost of goods sold, or COGS) — the direct cost of producing what was sold: raw materials, factory labor, the electricity running the machines, shipping the product in.

Subtract one from the other and you get **gross profit**. Divide gross profit by revenue and you get gross margin:

> gross margin = gross profit ÷ revenue = (revenue − cost of revenue) ÷ revenue

A bakery that sells $100 of bread and spent $35 on flour, butter, ovens' power and bakers' time has $65 of gross profit, a 65% gross margin. Sixty-five cents of each sales dollar are left to pay for everything else: rent, marketing, the accountant, interest, taxes, and, if anything remains, profit for the owners.

Here is the same calculation on Micron's reported numbers, with the inputs filled in:

```widget:metric ticker=MU metric=gross_margin
```

## What gross margin reveals

Gross margin is a fingerprint of the business model. Very different companies land in very different ranges, and the range tells you how they make money.

```widget:compare tickers=COST,MU,AAPL,MSFT,NVDA metric=gross_margin
caption="Only MU is reported data; the others are sample figures for illustration."
```

Look at the spread:

- **A warehouse retailer** runs on a thin gross margin on purpose. It resells other companies' products at close to cost and makes its money on volume and membership fees. A low gross margin here is the *strategy*, not a warning sign.
- **A hardware maker** sits in the middle. It pays for chips, screens and assembly, but a strong brand lets it charge well above those costs.
- **A software company** has high gross margins because copying software costs almost nothing. Once the product exists, each extra sale is nearly all gross profit.
- **A chip designer with a hot product** can post software-like gross margins while demand exceeds supply.
- **A memory-chip maker** like Micron sits wherever the cycle puts it. Its costs are mostly fixed factories, so when memory prices rise, nearly all of the increase drops to gross profit, and when prices fall, gross margin collapses.

The lesson: compare gross margins *within* an industry, not across them. A grocer at 13% and a software firm at 70% could both be excellent businesses.

## Why a change in gross margin matters more than the level

Within one company, the *direction* of gross margin over time is where the insight lives.

A rising gross margin usually means one of three things: the company raised prices without losing customers (pricing power), its costs fell (scale, better manufacturing), or its mix shifted toward higher-margin products. A falling gross margin can mean competition forced prices down, input costs rose faster than prices, or the product mix shifted the other way.

Micron's history shows how dramatic this can be in a cyclical industry:

```widget:history ticker=MU metric=gross_margin average=true
```

In the boom year of fiscal 2018, Micron kept well over half of each sales dollar as gross profit. In fiscal 2023, its gross margin actually went *negative*: it cost more to make the chips it sold than customers paid for them, partly because the company wrote down the value of inventory it was holding at prices the market no longer supported. Same company, same factories, same kind of product. The dashed line shows the average across the whole period, which is a far better guide to "normal" than any single year.

## What gross margin leaves out

Gross margin stops at the factory door. It ignores:

- **Operating costs** like research, sales teams and headquarters. A drug maker can have a sky-high gross margin and still lose money after funding years of research.
- **Interest and taxes.**
- **Capital spending.** A company can report a healthy gross margin while pouring cash into new factories. (Depreciation of those factories does show up in cost of revenue, but only gradually.)
- **Accounting choices.** Companies draw the line between "cost of revenue" and "operating expenses" slightly differently, so small differences between competitors may be definitional.

That's why gross margin is the *first* margin, not the only one. The next article walks down the rest of the income statement.

## The takeaway

Gross margin answers a simple, powerful question: for every dollar a customer pays, how much is left after making the product? High and stable suggests pricing power or a product that costs almost nothing to copy; low but steady can be a deliberate volume strategy; wild swings point to a cyclical industry where any single year can mislead.

Practice computing it on real filings:

```widget:quiz lesson=u2-l1
```
