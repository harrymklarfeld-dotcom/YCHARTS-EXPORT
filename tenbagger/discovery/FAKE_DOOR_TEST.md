# Fake-Door Test: Learn vs Money Hub

A **fake-door test** shows people a real-looking offer before the product fully exists and measures who "walks through the door": who signs up, or who clicks "Reserve". It tests demand with **actions**, not opinions. Always tell people honestly on the next screen that it's early access, and **never take payment without delivering**.

**Questions it answers:**
- **D1:** which headline pulls students in?
- **E3:** will they reserve a paid plan?

These feed the day-28 gate in `docs/MARKET_ENTRY.md` §2.

---

## 1. What already exists in `tenbagger/web/`

- An Astro site with a landing page, a playable lesson, the screener, a MoneyDemo ("can I cover the card?") and pricing.
- The hero text comes from `site.config.ts` → `heroLine` and `heroSub`.
- The waitlist form (`src/components/Waitlist.astro`) POSTs `{ email, source }` as JSON to `site.waitlist.endpoint`. **The endpoint is currently `''`, so sign-ups are saved only in the visitor's own browser. You would receive nothing.**
- Each `<Waitlist source="...">` tags where a sign-up came from: `landing`, `pricing`, `about`, `app`, `company-<TICKER>`.
- **Gap:** every pricing-card button links to `/#waitlist`, so you can't tell *which plan* someone clicked.

## 2. Setup (about 2 hours)

1. **Connect the form.** Create a free Formspree (or Buttondown, Tally, or Supabase edge function) endpoint that accepts JSON. Paste its URL into `site.config.ts` → `waitlist.endpoint`. Test one sign-up yourself.
2. **Make two variants.** Easiest approach: **two deployments** of the same site, e.g. two free Cloudflare Pages or Netlify projects, `learn.<domain>` and `money.<domain>`, each built with a different `site.config.ts`.

   | | Variant L: "Learn" | Variant M: "Money hub" |
   |---|---|---|
   | `heroLine` | Learn to read any public company's numbers, 3 minutes a day. | Know if you can cover your card, every day, even when your pay is irregular. |
   | `heroSub` | Bite-size drills built from real SEC filings, never stock tips. Then read your own money like a 10-K. | A daily yes/no on your card due date, counting the hours you've worked but haven't been paid for. Then learn to read your money like a 10-K. |
   | Waitlist `source` on landing | `L-landing` | `M-landing` |
   | Section order | Lesson demo first | MoneyDemo first |

   Change only the headline, subhead and first section. Everything else stays identical, so any difference comes from the pitch.
3. **Record plan clicks (the price fake door).** Ask whoever maintains `web/` (or do it yourself) for a small change: pricing buttons link to `/#waitlist?plan=pro|student|pass`, and the form appends `plan` to `source` (e.g. `L-landing-plan-student`).

   Simpler alternative with no code: the Formspree "thank you" page shows three buttons, "Reserve Student $39.99/yr", "Reserve Pro $79.99/yr" and "Recruiting Pass $49", each linking to a separate tiny form or a tracked link (bit.ly). The next screen says: *"Thanks! We're not charging yet. You're first in line at this price when we launch."*
4. **Count visitors.** Add a free privacy-friendly counter (Cloudflare Web Analytics, or GoatCounter) to each deployment, so you have the *denominator* (the number of visitors) for the sign-up rate.
5. **Randomise warm traffic.** When you share with clubs and classmates, alternate links by person, or use one link to a tiny redirect that picks L or M at random. Otherwise one variant gets your friendliest audience.

## 3. $50 budget options (pick one)

| Option | What $50 buys | Good for | Watch-out |
|---|---|---|---|
| **A. Meta (Instagram) traffic ads**, US, ages 18–24, interests "investing" + college; two ads, one per variant, $25 each | About 70 clicks at $0.70 average traffic CPC ([WordStream 2025](https://www.wordstream.com/blog/facebook-ads-benchmarks-2025) [S]); finance CTR (click-through rate) is among the lowest (1.46%) | A cold-traffic read | Too few clicks for significance alone. Use Meta's A/B split so each variant gets the same audience. |
| **B. Reddit promoted post** in 2–3 finance and college subreddits | Roughly 30–80 clicks [U] | Reaches intent-rich investors | Comments can be brutal; the ad must follow Reddit's financial-ad policy |
| **C. Offline: pizza + flyers with QR codes** at 2 club meetings (L code on half the flyers, M on the other half) | About 40–80 warm scans | Best cost per sign-up; you also get conversations | Warm traffic inflates rates; compare against warm benchmarks only |
| **D. Split:** $30 on option C + $20 boosting your own Instagram post | Mix | Balanced | Keep sources tagged |

**Recommendation:** C, then A with any leftover budget. Free sharing (OUTREACH.md) should supply most of the traffic.

## 4. Success thresholds

| Metric | Go | Re-test | Stop / rethink | Benchmark |
|---|---|---|---|---|
| Landing → sign-up, **warm** (clubs, friends) | ≥ 10% | 4–10% | < 4% | PRODUCT_STRATEGY W2 gate; LaunchList ([tool](https://getlaunchlist.com/tools/waitlist-benchmark) [U]) |
| Landing → sign-up, **cold** (ads, strangers) | ≥ 4% | 2–4% | < 2% | Consumer apps 4–8% cold; typical pages 2–5% ([getwaitlist](https://getwaitlist.com/blog/waitlist-benchmarks-conversion-rates) [U]); consumer-app median ~4.1% ([LanderLab](https://landerlab.io/blog/landing-page-conversion-rate) [U]) |
| Sign-ups who reserve a paid plan | ≥ 5% | 2–5% | < 2% | PRODUCT_STRATEGY red team #3 |
| Waitlist size by day 28 / day 45 | 500 / 1,000 | — | < 1,000 by day 45 means distribution is the bottleneck | PRODUCT_STRATEGY §6 #7 |
| **Winner: L vs M** | Call a winner if one is **≥ 1.5×** the other with **≥ 150 visitors per variant** (directional). About 430 per variant are needed to reliably tell 5% from 10%. | Gap < 1.5× → treat as a tie and keep Learn (cheaper to run, no bank data) | — | Two-proportion test, 95% confidence / 80% power |

**The decision rule (D1):**
- **L wins or ties:** Learn is the front door, and the hub stays a free daily feature.
- **M wins by ≥ 1.5×:** re-run once with fresh traffic. If M wins again, lead with the hub. Then get the Plaid quote and plan the GLBA security work before linking any bank (MONEY_HUB §3–4).

## 5. Log it

Keep one row per day in a sheet: `date, variant, source, visitors, signups, reserve_student, reserve_pro, reserve_pass, spend_usd`. Compute the rates weekly. Don't peek and stop early the moment one variant looks ahead: early leads flip often.

## 6. Honesty and legal checklist

- The next screen after sign-up says it's early access and that nothing has been charged.
- No "limited spots" or fake countdowns.
- The privacy page (`/legal/privacy`) already says what's stored. Update it once the endpoint is live, because it currently says sign-ups stay in the browser.
- No investment claims in ads ("beat the market", "10x"). The education-only framing stays.
