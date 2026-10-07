---
# Copy this file to articles/<slug>.md. The file name must equal the slug.
slug: my-new-article
title: "A clear, specific title"
summary: One sentence that says what the reader will be able to do afterwards.
minutes: 5
level: beginner            # beginner | intermediate | advanced
unit: u2-margins           # a unit id from data/lessons.json
relatedLessons: [u2-l1]    # lesson ids from data/lessons.json
metrics: [gross_margin]    # metric keys from widgets.json → metrics
tags: [margins, basics]    # lowercase-kebab
updated: 2026-09-25
---

Open with one short paragraph that says why this number matters, in plain English.

## The idea

Explain the concept with an everyday example first. Use round, clearly illustrative numbers
("imagine a bakery that sells $100 of bread").

```widget:metric ticker=MU metric=gross_margin
```

## Seeing it in real companies

Point at what the chart shows instead of typing the numbers yourself; the widget stays current when data updates.

```widget:compare tickers=MU,COST,MSFT metric=gross_margin
caption="Sample data for COST and MSFT"
```

## What it doesn't tell you

Every metric has blind spots. Name them.

```widget:quiz lesson=u2-l1
```
