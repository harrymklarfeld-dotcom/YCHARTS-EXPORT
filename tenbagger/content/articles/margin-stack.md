---
slug: margin-stack
title: "The margin stack"
summary: Gross, operating and net margin read together, top to bottom, show exactly where each sales dollar goes — and where a business is different from its peers.
minutes: 6
level: beginner
unit: u2-margins
relatedLessons: [u2-l2, u2-l3, u2-l4]
metrics: [gross_margin, operating_margin, net_margin]
tags: [margins, income-statement]
updated: 2026-09-25
---

One margin is a data point. Three margins, read in order, are a map. The **margin stack** is simply gross margin, operating margin and net margin lined up top to bottom. Each step down shows one more category of cost being paid, and the gaps between the steps tell you where the money goes.

## The three layers

Picture one dollar of sales flowing down the income statement:

1. **Gross margin** = gross profit ÷ revenue. What's left after the direct cost of the product.
2. **Operating margin** = operating income ÷ revenue. What's left after *also* paying for running the business: research and development, sales and marketing, general and administrative costs.
3. **Net margin** = net income ÷ revenue. What's left after *also* paying interest on debt and income taxes (and adding any interest earned or one-off gains).

Each layer can only be lower than the one above it in a normal year, because each one subtracts more costs. (Net margin can occasionally sit *above* operating margin when a company earns a lot of interest on its cash or books a one-time gain; that itself is worth noticing.)

## Micron's stack

Here are Micron's three margins for its latest fiscal year, from reported figures:

```widget:metric ticker=MU metric=gross_margin
```

```widget:metric ticker=MU metric=operating_margin
```

```widget:metric ticker=MU metric=net_margin
```

Read it as a story. Of every dollar customers paid, about forty cents survived the factory. Roughly thirteen or fourteen more cents went to research, selling and overhead: for a chip maker, research is the big item, because staying competitive in memory means designing a new generation of chips every couple of years. Then interest and taxes took a few more cents, leaving a bit under a quarter of each sales dollar as profit.

## Reading the gaps

The *gaps* between layers are often more revealing than the layers themselves.

- **A big gap between gross and operating margin** means heavy spending on people and ideas: research, sales forces, marketing. That's typical of software, pharmaceuticals and chips. The question is whether that spending builds something lasting (new products, a sales network) or just keeps the lights on.
- **A small gap** means lean overhead. A warehouse retailer has a thin gross margin but also spends very little running the stores relative to sales, which is how it survives on a few cents per dollar.
- **A big gap between operating and net margin** usually points to heavy interest payments (lots of debt) or a high tax rate. It can also be one-time items; always check.
- **Net margin above operating margin** means something outside the core business added profit. Interest income, investment gains, or a tax benefit. Pleasant, but usually not repeatable.

## Comparing stacks across companies

Operating margin is often the most useful single layer for comparing businesses, because it captures the whole cost of running the company but ignores how it's financed and taxed.

```widget:compare tickers=MU,COST,AAPL,MSFT,KO metric=operating_margin
caption="MU is reported data; COST, AAPL, MSFT and KO are sample figures."
```

Two companies can reach similar operating margins by completely different routes. One might have a very high gross margin and spend heavily on marketing (a beverage brand); another might have a modest gross margin and tiny overhead. The stack shows you *which route* each one took, which matters when you ask what could go wrong. A brand that depends on marketing is exposed if that marketing stops working; a lean operator is exposed if its small edge on price disappears.

## The stack moves with the cycle

Margins also change over time, and in a cyclical business the whole stack moves together, with the lower layers moving *more* than the top one. That's **operating leverage**: research and overhead costs are fairly fixed, so when revenue falls, they eat a bigger share of each dollar.

```widget:history ticker=MU metric=operating_margin
```

When Micron's revenue roughly halved in fiscal 2023, its operating margin didn't just shrink; it went deeply negative, because the company kept paying for research and staff while memory prices collapsed. In the recovery, the same fixed costs were spread over far more revenue, and the operating margin snapped back. A small change in sales can cause a large change in operating profit, in both directions.

## Three habits for reading any margin stack

1. **Read top to bottom, then look at the gaps.** Where does most of the dollar disappear?
2. **Compare with close peers, not with everyone.** Different industries have naturally different stacks.
3. **Look at several years.** A single year's stack in a cyclical company can describe the peak or the trough, not the business.

## The takeaway

The margin stack turns an income statement into three percentages you can keep in your head. It tells you how much a company keeps, where the rest goes, and how sensitive profit is to a change in sales. Once you can read a stack, every other profitability metric (return on capital, cash conversion, valuation multiples) makes more sense.

Put it into practice with real filings:

```widget:quiz lesson=u2-l4
```
