# Google Play Financial features declaration

Every app must complete this form, including apps with no financial features
([Play help: Financial features declaration](https://support.google.com/googleplay/android-developer/answer/13849271),
[Financial Services policy](https://support.google.com/googleplay/android-developer/answer/9876821)).
Play Console → Policy → App content → Financial features.

The form groups checkboxes roughly as Banking and loans, Payments and transfers, Trading and funds
(including "Stock trading and portfolio management", crypto and crowdfunding), Support services
(credit monitoring, **financial advice**, insurance), and Other. The checkbox list here comes from
search-snippet summaries; confirm the labels in the console when you file.

## v1.0 answer

**"My app doesn't provide any financial features."**

Why this is accurate: the app teaches how to read public-company financial statements from bundled
public data. It does not move money, lend, hold deposits, execute or route trades, manage
portfolios, give personalized advice, or connect to financial accounts. The Money tab shows a
fictional sample persona only. Subscriptions are sold through Google Play Billing, which is not a
financial feature under this policy.

Do **not** tick "Financial advice". The product is impersonal education (*Lowe v. SEC* publisher
framing, `docs/PRODUCT_STRATEGY.md` §1.4), and ticking it invites requests for licensing documents.

## v1.x answer (read-only brokerage / bank linking via Plaid or SnapTrade)

Decide with counsel before that release. Recommended:

- Tick **Other** and describe it: *"Read-only aggregation of the user's own brokerage and bank
  account data via Plaid/SnapTrade, displayed for educational purposes. No trading, payments,
  transfers, lending, or investment advice."*
- Do **not** tick "Stock trading and portfolio management". We neither trade nor manage portfolios.
  If Google's reviewer disagrees, you may be asked for documentation; keep the counsel memo ready.
- Never add credit, loans, cash advances or earned-wage access. `BANNED_OFFER_CATEGORIES` in
  `src/config/monetization.ts` already enforces this for affiliate offers. Those features trigger
  country licensing documentation and a 36% APR cap in the US.

## Related Play declarations for finance-adjacent apps

- **Affiliate offers** (`FLAGS.affiliateEnabled`, off by default): if turned on, they must carry
  clear disclosure and must not promote loans. Google treats apps that promote financial products
  as within the Financial Services policy's disclosure scope.
- **Deceptive behavior**: the listing must not imply returns ("10x", "beat the market"). Our copy
  says "Education, never stock tips".
