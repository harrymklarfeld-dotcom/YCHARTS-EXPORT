# Survey (paste into Google Forms)

**Purpose.** Interviews tell you *why*. This survey tells you *how many*. Aim for **≥ 150 responses** from at least 3 campuses by day 28. Below 100 responses, treat the percentages as rough.

**Setup tips**
- Keep it anonymous. The email field at the end is optional, and it doubles as a waitlist.
- Turn on "Shuffle option order" for the multiple-choice lists (not the scales). Otherwise options near the top get picked more just because they are near the top.
- Takes about 4 minutes. Say so in the intro.
- Don't mention the app until Q14, so the earlier answers aren't coloured by it.

**Intro text:**
> "4-minute survey about how college students handle investing and money. Anonymous. Run by a [school] sophomore for a class/startup project. Optional: leave your email at the end for results."

---

## Questions

**Section 1: About you**

1. **What year are you in?** *(multiple choice)*
   - Freshman · Sophomore · Junior · Senior · Grad student · Graduated in the last 3 years · Not a student

2. **Your major area?** *(multiple choice)*
   - Business / Finance / Accounting · Economics · STEM · Humanities / Social sciences · Undecided · Other

3. **Which of these do you have right now?** *(checkboxes)*
   - Brokerage account (Robinhood, Fidelity, Schwab, etc.) · Roth IRA · 401(k) or other work retirement plan · Crypto · Credit card · A job or gig income during the semester · None of these

4. **Are you in an investment club, finance society, or similar?** *(multiple choice)*
   - Yes, active member · Yes, but rarely go · No, but interested · No

5. **Are you recruiting (or planning to) for investment banking, equity research, asset management, or consulting?** *(multiple choice)*
   - Yes, this year · Yes, in a future year · Maybe · No

**Section 2: Investing (skip to Section 3 if you don't invest)**

6. **In the last 30 days, how many times did you look up information about something you own or are thinking of buying?** *(multiple choice)*
   - 0 · 1–2 · 3–5 · 6–10 · More than 10

7. **The last time you tried to understand a company or fund, where did you go?** *(checkboxes)*
   - Google · YouTube · TikTok/Instagram · Reddit · ChatGPT or another AI · My broker's app · Company filings (10-K, earnings) · A friend or club · A paid course or newsletter · Other

8. **How confident are you explaining how a company you own makes money, and whether it's profitable?** *(linear scale 1–5)*
   - 1 = no idea · 5 = could explain it to a friend with numbers

**Section 3: Money**

9. **In the last 12 months, have any of these happened to you?** *(checkboxes)*
   - Paid a credit card late fee · Paid credit card interest · Overdrafted a bank account · Worried whether I could pay a bill on time · Got paid late because I hadn't submitted hours or a timesheet · None of these

10. **How often do you check your bank or card balance?** *(multiple choice)*
    - Several times a day · About daily · A few times a week · Weekly · Rarely

**Section 4: Paying for things**

11. **In the last 12 months, have you paid for anything to learn investing, finance or careers?** *(checkboxes)*
    - Online course (Wall Street Prep, BIWS, CFI, Udemy, etc.) · App subscription · Newsletter · Book · Club dues that include training · ChatGPT Plus or another AI plan · Nothing

12. **Which of these would you most want help with this semester?** *(multiple choice, pick one)*
    - Understanding the companies and funds I own · Preparing for finance interviews · Knowing if I can cover my card and bills on time · Starting to invest at all · None of these

13. **If an app did your answer to Q12 really well, which price feels acceptable?** *(multiple choice)*
    - Only free · Up to $20/year · $20–40/year · $40–80/year · More than $80/year · A one-time $49 would be fine for interview prep

**Section 5: Last two**

14. **Which headline makes you more curious?** *(multiple choice; shuffle)*
    - "Learn to read any company's numbers, 3 minutes a day. Built from real SEC filings."
    - "Know if you can cover your card, every day. Even when your pay is irregular."
    - Neither

15. **Want early access and the survey results? Leave your email (optional).** *(short answer)*

---

## Analysis plan

Export to Google Sheets. Use pivot tables or `COUNTIFS`. Always report **n**, the number of people behind each percentage.

| Hypothesis (from MARKET_ENTRY §11) | Questions | Validates if | Invalidates if |
|---|---|---|---|
| **H1** Student investors have a recurring, unsolved need to understand what they own | Q3 (brokerage or Roth) × Q6, Q7, Q8 | ≥ 50% of investors looked things up ≥ 3 times in 30 days **and** ≥ 40% rate confidence ≤ 3 | < 30% looked ≥ 3 times, or most rate 4–5 |
| **H1b** AI already solves it | Q7 | "ChatGPT/AI" chosen by < 50% of investors, **or** chosen alongside low confidence (Q8 ≤ 3) | AI chosen by > 60% **and** Q8 ≥ 4 for most of them (AI works for them) |
| **H2** The Learn door beats the Money door | Q12, Q14 | "Understand what I own" + "Interviews" > "Cover my card" in Q12, and the Learn headline wins Q14 | "Cover my card" wins both → run the hub-first test seriously |
| **H2b** The money pain is real for working students | Q3 (job + card) × Q9, Q10 | ≥ 30% of working cardholders report a late fee, interest or a bill worry; ≥ 50% check at least daily | < 15% report any event |
| **H3** Students will pay about $40 a year | Q11, Q13 | ≥ 25% have paid for something in Q11; ≥ 35% choose $20–40 or more (or the $49 one-time) | ≥ 70% choose "Only free" |
| **H4** Club members are the right beachhead | Q4 × Q6, Q11, Q13 | Club members over-index vs non-members (≥ 1.5×) on lookups and paying | No difference, which means clubs are only a distribution channel, not a segment |
| **H5** Recruits are the paying core | Q5 × Q11, Q13 | ≥ 40% of "recruiting this year" have paid (Q11) or pick the $49 option | Recruits don't differ from others |

**Watch for bias.** Survey takers from your own club are friendlier than the market. Tag each distribution link with a source (e.g. separate Form copies, or an added hidden-choice question "Where did you find this survey?") and compare warm vs cold answers. **A stated price (Q13) always overstates real payment.** Trust the fake-door clicks and deposits (`FAKE_DOOR_TEST.md`) more than Q13.
