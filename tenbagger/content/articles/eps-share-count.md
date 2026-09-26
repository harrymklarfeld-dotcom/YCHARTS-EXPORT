---
slug: eps-share-count
title: "EPS and share count tricks"
summary: Earnings per share turns profit into a per-slice number — which means it moves when the number of slices changes, even if the profit doesn't.
minutes: 6
level: intermediate
unit: u3-profit
relatedLessons: [u3-l2, u3-l3]
metrics: [eps_diluted, shares_diluted, net_income, eps_growth_yoy]
tags: [eps, buybacks, dilution, income-statement]
updated: 2026-09-25
---

Net income tells you how much the whole company earned. But a shareholder doesn't own the whole company; they own a slice. **Earnings per share (EPS)** answers the question every owner actually cares about: how much profit belongs to *one* share?

> EPS = net income ÷ number of shares

Simple enough. But because EPS is a fraction, it can change for two reasons: the top (profit) or the bottom (shares). Most headlines talk only about the top. This article is about the bottom.

## Basic vs. diluted

Companies report two versions:

- **Basic EPS** divides by the shares that exist today, on average across the year.
- **Diluted EPS** divides by the shares that *would* exist if every stock option, restricted stock unit and convertible bond turned into shares.

Diluted is the more conservative and the more honest number, because those extra shares are real claims on future profit. Tenbagger uses diluted EPS everywhere. Here is Micron's, with the division shown:

```widget:metric ticker=MU metric=eps_diluted
```

(Our figure divides annual net income by average diluted shares, so it can differ from the number printed in the 10-K by a cent.)

## Trick one: buybacks lift EPS without lifting profit

Imagine a company earning $100 million with 50 million shares. EPS is $2.00. Now it spends cash to repurchase 5 million of its own shares and retire them. Profit is unchanged at $100 million, but it's now divided among 45 million shares: EPS rises to about $2.22, an 11% "increase" with no change in the business.

That isn't necessarily bad. If the company had spare cash and nothing better to do with it, reducing the share count genuinely increases each remaining owner's slice. But it means **EPS growth and profit growth are different things**, and it pays to know which one you're looking at. A company can report steady EPS growth for years while its actual net income is flat, purely by shrinking the share count.

Try it with the calculator. Start with an illustrative $40 share price and $2.00 of EPS, then slide EPS up to $2.22 to mimic the buyback. At the same price, the P/E falls and the earnings yield rises, though nothing about the underlying business changed:

```widget:calculator kind=pe price=40 eps=2
caption="Illustrative numbers, not a real company."
```

Two questions keep buybacks honest:

1. **What did the shares cost?** Repurchasing shares at a very high price per dollar of earnings adds little per-share value; the same cash might have done more elsewhere.
2. **Did the share count actually fall?** Many companies repurchase shares mainly to offset new shares issued to employees. The headline "billions in buybacks" can coexist with a flat share count.

## Trick two: dilution quietly shrinks your slice

The opposite happens when the share count grows. Companies issue new shares to raise money, to pay for acquisitions, or to pay employees through stock-based compensation. Each new share is a new claim on the same profit.

Stock-based compensation is the subtle one. It's a real cost: employees are being paid with a slice of the company instead of cash. Some companies emphasize "adjusted" earnings that add this cost back, which flatters the result. Diluted EPS from the official income statement doesn't do that, which is another reason to prefer it.

A useful habit: look at the diluted share count over several years. Falling means owners' slices are growing; rising means they're being diluted; flat means buybacks and issuance roughly cancel out.

```widget:metric ticker=MU metric=shares_diluted
```

## Trick three: EPS growth from a tiny base

EPS growth percentages can be wildly misleading when the starting point is near zero. Look at Micron's history:

```widget:history ticker=MU metric=eps_diluted
```

Micron earned $0.70 per share in fiscal 2024 and $7.59 in fiscal 2025. That's more than ten times as much, or almost 1,000% "growth." True, and nearly meaningless as a forecast: fiscal 2024 was a recovery year following a loss. And when the prior year is *negative*, as fiscal 2023 was, a growth rate can't be calculated at all; our data leaves it blank rather than invent one.

When you see a huge EPS growth number, check the starting point. Then check a longer window: average EPS across a full cycle is a much steadier anchor than any single year's change.

## What EPS still tells you

With those caveats, EPS is genuinely useful. It's the "E" in the P/E ratio, it puts companies of different sizes on a per-share basis, and over long periods, growth in EPS is one of the main engines of a share's value. The trick is to read it together with:

- **Net income**, to separate business growth from share-count effects.
- **Share count history**, to spot buybacks or dilution.
- **Free cash flow per share**, to check the profit is turning into cash.

## The takeaway

EPS is profit divided by shares, and both halves of that fraction move. Buybacks can lift EPS without growing the business; dilution can shrink it while the business grows; and growth rates off a near-zero base can look spectacular. Use diluted EPS, watch the share count, and always ask what's driving the change.

Practice with real filings:

```widget:quiz lesson=u3-l2
```
