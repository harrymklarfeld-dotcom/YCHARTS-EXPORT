---
slug: free-cash-flow
title: "Free cash flow: the number that pays the bills"
summary: Profit is an accounting opinion; cash is a fact. Free cash flow is the cash a business produces after paying to keep itself running and growing.
minutes: 6
level: beginner
unit: u4-cashflow
relatedLessons: [u4-l1, u4-l2, u4-l3]
metrics: [free_cash_flow, operating_cash_flow, capex, fcf_margin]
tags: [cash-flow, fcf, basics]
updated: 2026-09-25
---

There's an old saying in finance: *profit is an opinion, cash is a fact.* Net income depends on dozens of accounting judgments: when to recognize a sale, how fast a machine wears out, what inventory is worth. Cash is simpler. Either it came into the bank account or it didn't.

**Free cash flow (FCF)** is the cash a business generated in a year after paying for everything it needed to keep operating and investing. It's the money that can actually be used: to pay dividends, repurchase shares, pay down debt, make acquisitions, or simply pile up for a rainy day.

## The formula

Free cash flow comes from the **cash flow statement**, the third of the big financial statements and the one beginners most often skip.

> free cash flow = cash from operations − capital expenditures

- **Cash from operations** starts with net income and adjusts it back toward actual cash. It adds back non-cash charges like depreciation, and accounts for money tied up in (or released from) inventory, customer bills and supplier bills.
- **Capital expenditures (capex)** is cash spent on long-lived assets: factories, equipment, data centers, stores.

Here's Micron's, from its reported figures:

```widget:metric ticker=MU metric=free_cash_flow
```

That result deserves a second look. Micron's operating cash flow was large (larger, in fact, than its net income), but it spent almost all of it on new factories and equipment. What was left over, the free part, was a small fraction of reported profit.

## Why FCF and profit diverge

Three things commonly push free cash flow away from net income:

1. **Depreciation vs. capex.** When a company pays for a machine, the cash leaves immediately, but the income statement spreads the cost over the machine's useful life as depreciation. A company investing heavily *now* shows lower FCF than profit. A company that stopped investing shows the opposite, at least until its equipment wears out.
2. **Working capital.** Selling on credit creates profit before cash arrives. Building up inventory uses cash before any sale happens. A fast-growing company often has profit running ahead of cash.
3. **Non-cash items.** Stock-based compensation, write-downs and other charges reduce profit without using cash (or vice versa).

None of these is automatically good or bad. Heavy capex can be the price of future growth. But over many years, a business whose profit *never* turns into free cash is a business worth questioning.

## FCF margin: comparing companies fairly

Like profit, free cash flow is easier to compare as a share of revenue. **FCF margin** = free cash flow ÷ revenue: cents of free cash per sales dollar.

```widget:compare tickers=MU,COST,MSFT,AAPL,KO metric=fcf_margin
caption="MU is reported data; COST, MSFT, AAPL and KO are sample figures."
```

Asset-light businesses (software, brands that outsource manufacturing) tend to convert a large share of revenue into free cash. Asset-heavy businesses (chip fabs, oil, utilities, retailers building stores) convert less, because they must keep reinvesting. A retailer's FCF margin may look small, but on enormous revenue it can still be a lot of cash; a chip maker's can swing from strongly positive to negative within two years.

## Free cash flow over time

A single year of FCF is especially noisy, because capex comes in waves. A company might spend heavily for two years building a factory, then much less once it's running. So look at the history:

```widget:history ticker=MU metric=free_cash_flow average=true
```

Micron's free cash flow swings more than its profit. In the best year shown, it produced billions of free cash; in fiscal 2023, when memory prices collapsed and it kept investing, free cash flow was deeply negative. The dashed average across the whole decade is a far more honest picture of what the business produces in a "typical" year, and it's the figure to reach for when valuing a cyclical company (more on that in the DCF articles).

## What free cash flow is used for

Once a company has free cash, it has five basic choices, and how it chooses tells you a lot about management:

- **Reinvest** in more growth (beyond the capex already counted).
- **Acquire** other businesses.
- **Pay down debt.**
- **Pay dividends.**
- **Repurchase shares.**

A company that consistently pays out more in dividends and buybacks than it generates in free cash is funding the gap with debt or savings, which can't last forever.

## Common pitfalls

- **"Adjusted" FCF.** Some companies define free cash flow their own way, for example excluding certain capex as "growth" spending. Stick to the plain formula: cash from operations minus all capex.
- **One-off working capital swings.** A single big customer payment arriving early can inflate one year's cash flow.
- **Leases.** Some businesses lease assets instead of purchasing them; the payments may not appear in capex at all. Compare within an industry.

## The takeaway

Free cash flow is the cash left after a business pays to keep itself running and growing. It's harder to dress up than earnings, and it's what ultimately funds every dividend and buyback. When profit and free cash tell different stories, the gap is where the interesting questions are.

Practice with real filings:

```widget:quiz lesson=u4-l2
```
