---
slug: your-money-like-a-10k
title: "Your money, like a 10-K"
summary: "Liquidity, free cash flow and debt for your own life: the same three questions analysts ask of a company, applied to a household."
minutes: 6
level: beginner
unit: u5-balance
relatedLessons: [u5-l4, u5-l2, u4-l2]
metrics: [current_ratio, net_cash, free_cash_flow]
tags: [personal-finance, liquidity, money-hub]
updated: 2026-09-25
---

Every public company files a 10-K, an annual report with a balance sheet, an income statement and a cash flow statement. Analysts read it with a handful of questions: can it pay its bills? Does it produce spare cash? How much does it owe?

Those questions aren't just for corporations. A household has the same three statements hiding in its bank and card accounts. Reading your own finances the way you'd read a 10-K is one of the most practical things this library can teach, and it's the idea behind the Money hub in the app.

## Statement one: the balance sheet (what you own and owe)

A company's balance sheet lists assets and liabilities. Yours does too:

- **Assets:** checking and savings, retirement and brokerage accounts, the value of a car or home.
- **Liabilities:** credit card balances, student loans, car loans, a mortgage.
- **Equity**, or **net worth**: assets minus liabilities.

Like a company, the *mix* matters as much as the total. Net worth tied up in a house or a retirement account is real, but you can't pay this month's electric bill with it. That's why analysts separate current from long-term, and why the most useful personal ratio is about the short term.

## The liquidity ratio: your personal current ratio

For a company, the **current ratio** compares assets that turn into cash within a year with bills due within a year:

```widget:metric ticker=MU metric=current_ratio
```

Micron's short-term assets cover its short-term obligations about two and a half times. The household version is simpler and stricter:

> liquidity ratio = cash (checking + savings) ÷ short-term debt (credit card balances and loan payments due now)

A ratio of 2 means you have twice as much cash as the card balance you owe. Below 1 means that if every card balance came due today, cash alone couldn't cover it. Try it with your own numbers or with the example amounts below:

```widget:calculator kind=liquidity cash=3000 card=1500
caption="Grades use the same bands as the Money hub. Nothing you enter here leaves your device."
```

The grade bands are a rough guide, not a verdict: a ratio of 2 or more (or no card balance at all) is an A, 1.5 to 2 a B, 1 to 1.5 a C, and below that the cushion gets thin. Try one experiment: move $500 from cash to the card (lower both sliders by $500). When cash already exceeds the balance, the ratio rises. When it doesn't, the same payment makes the ratio *fall*, even though the debt shrank. A ratio is a lens, so read it alongside the balance itself.

## Statement two: free cash flow (what's left each month)

A company's free cash flow is cash from operations minus capital spending. The personal version:

> personal free cash flow = take-home pay − regular spending − big one-off purchases

Here's why the company version is instructive. Micron's operations brought in a lot of cash last year, but it spent most of it on new factories:

```widget:metric ticker=MU metric=free_cash_flow
```

Households have their own "capex": a car, a new laptop, a roof repair, a move. These arrive in lumps, like a chip maker's fab upgrades. Two lessons carry over directly:

1. **Look at the average, not one month.** A month with a car repair isn't a disaster, and a month with a bonus isn't a raise. Averaging across a year gives a truer picture, exactly as normalizing does for a cyclical company.
2. **Positive free cash flow is what funds everything else.** For a company it funds dividends, buybacks and debt paydown. For a household it funds savings, extra debt payments and investing. If free cash flow is negative on average, the gap is being filled by savings or borrowing.

## Statement three: debt (who has a claim ahead of you)

For a company, **net cash** is cash minus debt. For a household, the same subtraction is revealing: cash in the bank minus balances on cards and short-term loans. Positive means you could clear that debt today.

Analysts also care about the *type* and *cost* of debt, and so does a household:

- **High-interest revolving debt** (credit cards) behaves like a company's expensive short-term borrowing. It compounds quickly and can squeeze free cash flow.
- **Long-term, lower-rate debt** (a fixed-rate mortgage) behaves more like a company's long-dated bonds: predictable payments tied to a long-lived asset.
- **Debt relative to income** matters more than the raw number, just as a company's debt is judged against its earnings.

And the cyclical lesson applies too. A company whose income swings needs more cushion than one with steady income. A household with irregular income (freelance, commission, seasonal work) benefits from a higher liquidity ratio for exactly the same reason.

## Putting it together

Read your own finances like a 10-K, once a month:

1. **Liquidity ratio.** Can cash cover what's due now?
2. **Free cash flow.** On average, is money left over after spending and lumpy purchases?
3. **Net cash and debt mix.** What do you owe, at what cost, and is it shrinking?

This is a description, not a to-do list. Everyone's situation is different, and the numbers are just a clearer way to see it.

## The takeaway

The tools analysts use on companies (current ratio, free cash flow, net cash) translate almost directly to a household. They answer the same questions: can the bills be paid, is there spare cash, and how much is owed? Reading your own numbers this way makes the company numbers more intuitive too, and the other way round.

Practice the company version with real filings:

```widget:quiz lesson=u5-l4
```
