# Interview Guide (20 minutes, Mom-Test style)

**The Mom Test** (Rob Fitzpatrick) is a way of interviewing that gets honest answers even from someone who wants to be nice to you, like your mom. It has three rules:
1. Talk about **their life**, not your idea.
2. Ask about **specific past events**, not hypotheticals ("would you...?").
3. **Listen more than you talk.**

Compliments ("that's a cool idea!") and promises ("I'd totally use that") are worth **zero**. Facts about what they already did, and commitments they make now, are worth a lot. ([summary](https://mtlynch.io/book-reports/the-mom-test/) [U])

**Goal:** by day 21, run 20 interviews: 8 × Segment A, 6 × B, 6 × C. Log each one in `tracker.csv` **within 1 hour**, while it is fresh.

**Do not show the app or the site until the last 3 minutes, if at all.** Once they see it, they start reacting to your idea instead of describing their life.

---

## 1. Screening questions (ask in a DM or a 1-minute form before booking)

| Question | Routes to |
|---|---|
| Are you a current US college student? (year, major) | Must be yes, or a graduate of under 3 years for Segment D |
| Do you have any money invested: brokerage, Roth IRA, 401k, crypto? Which? | Stocks, ETFs or Roth → **A**. Crypto only → note it, lower priority. |
| Are you recruiting, or planning to recruit, for banking, equity research, consulting or asset management? | Yes → **B** (people can be both A and B; pick the stronger one) |
| Do you work during the semester (job, gig, tutoring)? Do you have a credit card? | Both yes → **C** |
| Are you in an investment club or finance society? | Note it; it helps with referrals |

Skip anyone who has already seen your app or is a close friend. Friends are fine for practice, but don't count them.

---

## 2. The script

Keep to time. Keep questions open. After each answer, ask **"Tell me about the last time..."** or **"Why?"**

### 0:00–2:00. Set-up (all segments)
> "Thanks, this is really helpful. I'm a student researching how people our age deal with investing and money. There's nothing to sell, and no right answers. Mind if I take notes?"

### 2:00–5:00. Context (all segments)
- "Walk me through your money situation right now. Where does money come in, and where does it go?"
- "What's the most recent money-related thing you spent time on?"

### 5:00–15:00. Segment block (pick one)

**Segment A: student investor**
1. "When did you last buy or look at something you own? What was it, and what made you look?"
2. "Did anything about it confuse you? What exactly?" (listen for a *specific company, fund, number or term*)
3. "What did you do to figure it out?" (Google, YouTube, Reddit, ChatGPT, a friend, the broker's app). "How did that go?"
4. "How do you decide whether something you own is 'expensive' or 'a good business'? Show me, if it's on your phone."
5. "Have you ever paid for anything to learn investing: a course, an app, a newsletter, a book? What made you pay? Do you still use it?"
6. "When did you last open a company's actual financials (10-K, earnings report)? What happened?"

**Segment B: pre-finance recruit**
1. "Where are you in recruiting? What's the next deadline?"
2. "Tell me about your last technical interview or practice session. What question tripped you up?"
3. "What are you using to prepare? (WSP, BIWS, CFI, the 400 Questions guide, club training, ChatGPT.) Who paid? How much?"
4. "How many hours did you spend on prep last week? When and where?" (on your phone? at a laptop?)
5. "How do you know whether you're ready?"
6. "What did your club do at its last meeting? Who plans the content?"

**Segment C: working student with a card**
1. "Tell me about your last paycheck or payment for work. When did you do the work, and when did the money actually land?"
2. "When is your card due? How did you know that?" (did they know without checking?)
3. "Tell me about the last time you worried whether you could pay a bill. What did you do?"
4. "Have you ever paid a late fee or interest, or had an overdraft? What happened?"
5. "How often do you check your balance? Show me the app you use."
6. "Have you tried a budgeting app? Why did you stop, or why do you keep using it?"

### 15:00–18:00. Money and commitment (all segments)
- "What do you pay for monthly right now? Which one would you cancel first?"
- "If something solved [*the pain they just described, in their own words*], what would it replace?"
- **Commitment ask** (this is the real WTP signal; record which one they accept):
  - Lowest: "Can I send you a 3-question quiz on a company you own next week?"
  - Medium: "Would you introduce me to your club president or two friends like you?"
  - Highest: "We're taking $5 refundable deposits for the student plan. Want one?" (only once the deposit link exists)

### 18:00–20:00. Close
- "Who else should I talk to?" Ask for 2 names.
- "Can I follow up in 2 weeks?"
- Optional: show the site for 60 seconds. Log only what they *do*, like a click or asking for the link, not what they *say*.

---

## 3. What to listen for

| Strong signal (write it down word for word) | Weak or false signal (discount it) |
|---|---|
| A specific recent story with a date ("last Tuesday, when NVDA reported...") | "I usually...", "I would...", "I'd probably..." |
| They already built a workaround (spreadsheet, Notion, alarm, asking a friend) | "That's a cool idea" |
| They already spent money or time on it | "I'd pay for that" (no card out) |
| Emotion: embarrassment, stress, a late fee they still remember | Polite agreement |
| They ask *you* for the product or the link | "Let me know when it's ready" |
| "I asked ChatGPT and it was **wrong** / I couldn't check it" | "I just ask ChatGPT and it's fine" (a **threat** signal; record it) |

**Pain score (1–5), set after the call:**
- 1 = never thought about it
- 2 = mild annoyance
- 3 = they have a workaround and it's fine
- 4 = they have a workaround and it's painful, or they spent money on it
- 5 = it cost them real money or an opportunity recently, and they are actively looking for a fix

**WTP signal codes for the tracker:**
- `none`
- `paid-other` (already pays for something similar)
- `commit-time` (accepted the quiz or follow-up)
- `commit-intro` (gave introductions)
- `commit-money` (deposit)

---

## 4. Note-taking template (copy one per interview)

```
ID: I-__   Date: ____   Segment: A / B / C / D   Channel: club / class / Reddit / Discord / referral
Year & major: ______   Invests in: ______   Works: ___ h/wk   Card: Y/N   Club: ______

Context (2 lines):

Most recent specific story (who / what / when / what they did):

Current tools & spend ($/mo):

Workarounds:

Exact quotes (≥ 2):
 1. "
 2. "

Pain score (1–5): __    Why:
"ChatGPT solves it"?  Y / N / partly
WTP signal: none / paid-other / commit-time / commit-intro / commit-money
Referrals given: ______
Surprises (what I didn't expect):
Follow-up (what & when):
```

**After every 5 interviews**, reread your notes and ask:
- What have I heard 3+ times?
- Which segment has the most 4s and 5s?
- Am I hearing about a pain I didn't expect?

Update the "Decisions" in `docs/MARKET_ENTRY.md` §1 only on patterns, never on a single interview.
