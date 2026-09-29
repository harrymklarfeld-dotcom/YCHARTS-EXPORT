---
slug: napkin-dcf
title: "A DCF you can do on a napkin"
summary: A discounted cash flow estimate is just four inputs and one idea — money later is worth less than money now. Build one with sliders and see which assumption really drives the answer.
minutes: 7
level: intermediate
unit: u8-intrinsic
relatedLessons: [u8-l1, u8-l2, u8-l3]
metrics: [free_cash_flow, net_cash, shares_diluted]
tags: [valuation, dcf, intrinsic-value]
updated: 2026-09-25
---

A **discounted cash flow (DCF)** estimate sounds like the most intimidating tool in finance: spreadsheets with hundreds of rows, analysts arguing over decimals. Underneath, it rests on one idea you already know, and it needs only four inputs. You can do a perfectly respectable one on the back of a napkin.

The idea: **a business is worth the cash it will produce in the future, translated into today's dollars.**

## Money later is worth less than money now

Would you rather have $100 today or $100 in five years? Today, obviously: you could put it to work, and there's a risk the future $100 never shows up. So a future dollar has to be *discounted* to compare it with a dollar today.

If you require a 9% yearly return, then $100 arriving in one year is worth about $100 ÷ 1.09 ≈ $91.74 today. In two years, $100 ÷ 1.09² ≈ $84.17. The further away the cash, the less it's worth now. That percentage is the **discount rate**, and it represents the return you'd demand for waiting and for taking the risk.

## The four inputs

1. **Starting free cash flow.** The cash the business produces in a year after capex. (See the free cash flow article.)
2. **Growth rate.** How fast that cash grows over the next several years.
3. **Discount rate.** The return you require. Higher for riskier businesses.
4. **Terminal multiple.** After the forecast years, instead of forecasting forever, assume the business could be valued at some multiple of its cash flow at that point.

Then:

- Grow the free cash flow each year for five years and discount each year's cash back to today.
- At year five, value the rest of the company's life as *year-five FCF × terminal multiple*, and discount that back too.
- Add the two parts together, then add net cash (or subtract net debt), since owners get the cash and must repay the debt.
- Divide by the number of shares for a per-share figure.

That's the whole method. Here it is with illustrative inputs: a made-up company producing $100 million of free cash flow with 50 million shares and no debt:

```widget:calculator kind=dcf fcf=100000000 shares=50000000 net_cash=0 growth=0.06
caption="Illustrative company, not real data. Move one slider at a time."
```

## What the sliders teach you

Play with each input on its own, and some lessons jump out.

**The discount rate is powerful.** Nudging it from 9% to 10% changes the answer noticeably, because it compounds across every year and the terminal value. Small changes in how much return you demand produce big swings in value.

**The terminal value is most of the answer.** Look at the "share from terminal value" line. In a typical five-year DCF, the value assigned to everything *after* year five makes up well over half of the total, often around three quarters. That means your estimate depends mostly on an assumption about the distant future. Humility is warranted.

**Growth matters, but less than you might think over five years.** Moving growth from 6% to 8% changes the estimate, but not as dramatically as the discount rate or the terminal multiple.

**A terminal multiple hides a growth assumption.** A 15× multiple on cash flow is roughly what you'd get from assuming the cash grows about 2.5% a year forever and discounting at 9%: 1 ÷ (9% − 2.5%) ≈ 15. A 25× multiple quietly assumes much faster growth forever. The two ways of expressing the end value are two sides of the same coin.

## Trying it on a real company

The same calculator can start from a company's reported numbers. Here it's prefilled with Micron's latest free cash flow, net debt and diluted share count:

```widget:calculator kind=dcf ticker=MU
caption="Starts from Micron's reported free cash flow, net debt and share count. Assumptions are yours."
```

For most steady businesses, starting from the latest year's free cash flow is reasonable. For a company whose cash flow swings with an industry cycle, as Micron's does, one year can be wildly unrepresentative, so the calculator includes a switch to start from the *average* instead. The cycles article explores exactly why that switch matters.

## A napkin DCF is a thinking tool

A DCF doesn't produce "the" value of a company. It produces the value *implied by your assumptions*. That makes it useful in two ways:

- **It forces you to be explicit.** What growth are you assuming? What return do you require? You can't hide behind a vague feeling.
- **It can be run backwards.** Instead of asking "what's it worth?", ask "what growth would the current price require?" If the answer is "25% a year for a decade," that's informative.

Common mistakes to avoid:

- **Starting from an unusual year.** A peak or trough year of cash flow skews everything.
- **Growth above the discount rate.** Mathematically, that implies infinite value; practically, it means an assumption has gone wrong.
- **False precision.** An estimate to the cent from inputs you can't know to the percent is theatre. Think in ranges.

## The takeaway

A DCF is four inputs (starting cash flow, growth, discount rate and a terminal multiple), plus net cash and a share count. The math is simple; the judgment is in the inputs. Use the sliders to feel which ones matter most, and treat the output as a range of possibilities, not a number to trust.

Practice with real filings:

```widget:quiz lesson=u8-l1
```
