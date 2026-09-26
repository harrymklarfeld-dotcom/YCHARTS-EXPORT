# App Store age rating answers

Apple's current questionnaire uses the 4+, 9+, 13+, 16+ and 18+ tiers. The old 12+ and 17+ tiers
are gone. Since 31 January 2026 you cannot submit until every question is answered, and since
September 2026 a **social-media capabilities** answer is also required
([Apple news](https://developer.apple.com/news/?id=ks775ehf),
[definitions](https://developer.apple.com/help/app-store-connect/reference/age-ratings-values-and-definitions/),
[2026 calendar](https://www.macobserver.com/news/app-store-age-rating-age-assurance-compliance-calendar/)).
App Store Connect → App Information → Age Rating → Edit.

Answers for the v1.0 binary:

| Section | Question (paraphrased) | Answer | Why |
|---|---|---|---|
| In-app controls | Parental controls | No | |
| | Age assurance | No | |
| Capabilities | Unrestricted web access | No | No in-app browser; the only external links go to our legal pages and store subscription settings |
| | User-generated content | No | No posts, comments or profiles |
| | Messaging / chat | No | |
| | Social-media capabilities (feed, followers, public profiles) | No | Leagues are placeholders. **Change this answer** if leagues or duels ship with visible usernames |
| | Advertising | **Yes** | Free users see AdMob ads (not in lessons, not on money screens) |
| Mature or suggestive themes | | None | |
| Violence (cartoon, realistic, prolonged, graphic) and violent themes | | None | |
| Profanity or crude humour | | None | |
| Horror or fear themes | | None | |
| Sexual content or nudity | | None | |
| Alcohol, tobacco, drug use or references | | None | |
| Medical or treatment information; health or wellness topics | | None | |
| Simulated gambling | | None | Hearts, XP and streaks are not chance-based and cannot be bought |
| Gambling (real money), contests | | No | No prizes, no sweepstakes |
| Loot boxes or chance-based purchases | | No | |
| Made for Kids | | **No** | Do not enter the Kids category (it bans third-party ads and analytics) |

**Expected computed rating:** 4+ or 9+ (advertising alone rarely raises it). **Decision: set the
age rating override to 13+.** The questionnaire lets you pick a higher rating than the computed
one. Reasons: the audience is teens and up (strategy doc: "stay 13+" to stay out of COPPA), the ads
come from a general-audience network, and finance content is not aimed at children. The privacy
policy should say the app is not directed at children under 13. If App Store Connect no longer
offers an override when you file, keep the computed rating and make sure nothing in the metadata
targets children.

Re-answer the questionnaire whenever you add chat, leagues with usernames, UGC or an in-app
browser.
