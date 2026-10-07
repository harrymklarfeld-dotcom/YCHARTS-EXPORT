# Tenbagger curriculum

Goal: take a complete beginner from "what is revenue?" to "why a single DCF on a
memory-chip maker at the top of its cycle misleads", using only real reported numbers
from `data/companies.json`. Every lesson opens with a short plain-English teaching card
(60-120 words), then 5-8 questions generated from real filings. The content explains
how the numbers work. It never tells anyone what to do with a stock.

Each lesson mixes question types in roughly this order: a guided multiple-choice
(with distractors built from the most common mistake), a numeric "do the math"
question, then a true/false, a compare (two real companies) and an order (rank 3-4
companies).

| # | Unit | Lessons |
|---|------|---------|
| 1 | **What a company sells** | 1.1 Revenue: the top line · 1.2 Revenue growth · 1.3 Compounding: 3-year CAGR |
| 2 | **Margins** | 2.1 Gross profit & gross margin · 2.2 Operating margin · 2.3 Net margin · 2.4 The margin stack |
| 3 | **Profit & EPS** | 3.1 Net income · 3.2 Earnings per share · 3.3 EPS growth · 3.4 Taxes: the effective rate |
| 4 | **Cash flow & FCF** | 4.1 Cash from operations vs. profit · 4.2 Free cash flow · 4.3 FCF margin · 4.4 Capex intensity |
| 5 | **Balance sheet & debt** | 5.1 Assets = liabilities + equity · 5.2 Net cash vs. net debt · 5.3 Debt-to-equity · 5.4 Current ratio |
| 6 | **Returns on capital** | 6.1 Return on equity · 6.2 Return on assets · 6.3 ROIC · 6.4 Leverage and ROE |
| 7 | **Valuation multiples** | 7.1 Market cap & enterprise value · 7.2 P/E & earnings yield · 7.3 P/S & EV/EBITDA · 7.4 FCF yield & dividend yield · 7.5 What a P/E implies about growth |
| 8 | **Intrinsic value** | 8.1 A one-line DCF · 8.2 A two-stage DCF · 8.3 Price vs. estimate & sensitivity · 8.4 Cycles: why one DCF can mislead |
| 9 | **Your portfolio** (personalizable) | 9.1 Your holding's margins · 9.2 Your holding's cash · 9.3 Your holding's valuation |

## Design notes

* **Progression.** Units 1-3 read the income statement top to bottom. Unit 4 moves to
  the cash-flow statement and Unit 5 to the balance sheet. Unit 6 connects all three
  (returns). Units 7-8 bring in the share price and ask what it implies.
* **Distractors are mistakes, not noise.** Gross margin distractors come from using net
  income or cost of goods by mistake. FCF distractors come from adding capex instead of
  subtracting it. EV distractors come from getting the sign of cash wrong. A distractor
  is dropped if it is too close to the answer to tell apart.
* **Implied growth (7.5).** A simplified identity: *required return ≈ earnings yield +
  growth*. With a 9% required return, a P/E of 30 (3.3% earnings yield) implies about
  5.7% growth, forever. It is a way to check your intuition, not a forecast.
* **DCF (8.1-8.3).** Perpetuity: `value = FCF × (1+g) / (r − g) + net cash`, with
  r = 9% and g = 2.5%. Two-stage: 5 years at the company's own 3-year revenue CAGR
  (clamped to 0-15%), then the perpetuity. The assumptions appear in each question's
  `source.params`.
* **Cyclicality (8.4).** Uses the 10-year history to show how far gross margin and FCF
  swing. The peak-year FCF divided by the average FCF shows how much a peak-year DCF
  overstates value.
* **Personalizable unit (9).** Prompts contain `{holding.*}` placeholders the app fills
  from a user's linked holdings. The shipped answer is computed for an example
  company, and `personalization.answer_metric` tells the app which formula to
  recompute. The questions only explain what a number means.
