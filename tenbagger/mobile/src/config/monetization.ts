/**
 * MONETIZATION CONFIG: the one file the founder edits to change plans, display prices,
 * free-tier limits, feature flags, ad placements/frequency caps and affiliate offers.
 *
 * Strategy recap (docs/PRODUCT_STRATEGY.md, docs/BENCHMARKS.md, docs/MONEY_HUB_RESEARCH.md):
 *  - Subscriptions are the business. Display ads earn little in a finance-education app with a
 *    small audience (Mint died ad-funded); ads and affiliate are a *supplement*, never the core,
 *    and never allowed to erode trust. Pro users never see ads.
 *  - Free tier is the habit + viral loop: daily puzzle, 1 new lesson a day (after an onboarding
 *    grace period), 3 saved screens, 1 linked bank (each Plaid Item costs us money every month).
 *  - We never offer credit, loans or cash advances (FTC actions vs Brigit/Dave/Cleo).
 *
 * PRICES HERE ARE FOR DISPLAY FALLBACK ONLY. Real, localized prices come from the App Store /
 * Google Play through RevenueCat offerings. Change the real price in App Store Connect /
 * Play Console (and the RevenueCat dashboard), then mirror it here so web/mock mode matches.
 */

// ---------------------------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------------------------

export type PlanId = 'pro_monthly' | 'pro_annual' | 'student_annual';
export type BillingPeriod = 'month' | 'year';

export type PlanConfig = {
  id: PlanId;
  label: string;
  /** Display fallback in USD. Real price = store price. */
  displayPriceUsd: number;
  period: BillingPeriod;
  /** Free-trial length in days (0 = none). Must match the intro offer configured in the store. */
  trialDays: number;
  /** RevenueCat package identifier inside the current offering. */
  rcPackageId: string;
  /** Store product id (App Store / Play). Informational; RevenueCat maps it. */
  storeProductId: string;
  /** Visually highlight on the paywall. */
  highlight?: boolean;
  /** Short line under the price, e.g. eligibility. */
  note?: string;
};

/** RevenueCat entitlement identifier that unlocks every Pro feature (Student maps to it too). */
export const PRO_ENTITLEMENT_ID = 'pro';

export const PLANS: Record<PlanId, PlanConfig> = {
  pro_annual: {
    id: 'pro_annual',
    label: 'Pro · Annual',
    displayPriceUsd: 79.99,
    period: 'year',
    trialDays: 7, // 7-day trial on annual only (PRODUCT_STRATEGY pricing table)
    rcPackageId: '$rc_annual',
    storeProductId: 'tenbagger_pro_annual',
    highlight: true,
  },
  pro_monthly: {
    id: 'pro_monthly',
    label: 'Pro · Monthly',
    displayPriceUsd: 12.99,
    period: 'month',
    trialDays: 0,
    rcPackageId: '$rc_monthly',
    storeProductId: 'tenbagger_pro_monthly',
  },
  student_annual: {
    id: 'student_annual',
    label: 'Student · Annual',
    displayPriceUsd: 39.99,
    period: 'year',
    trialDays: 0,
    rcPackageId: 'student_annual',
    storeProductId: 'tenbagger_student_annual',
    note: 'Requires a verified .edu email (checked once a year). Everything in Pro.',
  },
};

/** Order the plan cards appear on the paywall. */
export const PAYWALL_PLAN_ORDER: PlanId[] = ['pro_annual', 'pro_monthly'];

// ---------------------------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------------------------

export const FLAGS = {
  /** Master switch for ads (free users only; see AD_RULES). */
  adsEnabled: true,
  /** Affiliate OfferCards. Off until counsel reviews disclosures (FTC endorsement guides). */
  affiliateEnabled: false,
  /** Show the Student plan card on the paywall. */
  studentPlanEnabled: true,
  /** Rewarded "watch an ad for +1 heart" (user-initiated only). */
  rewardedHeartEnabled: true,
  /** Request personalized ads. Default false: non-personalized ads need no ATT prompt. */
  personalizedAds: false,
  /** Show the ATT prompt (iOS). Only meaningful if personalizedAds is true. */
  requestTrackingAuthorization: false,
};

// ---------------------------------------------------------------------------------------------
// Features and free-tier limits
// ---------------------------------------------------------------------------------------------

export type Feature =
  | 'daily_puzzle'
  | 'lessons' // new lessons per day (replays are always free)
  | 'practice_mode'
  | 'screener_presets_all'
  | 'saved_screens'
  | 'xray'
  | 'compare'
  | 'money_accounts' // linked banks/cards (Plaid Items)
  | 'money_alerts'
  | 'personal_10k'
  | 'articles_pro'
  | 'ad_free';

/**
 * Free-tier rule for each feature:
 *  - `true`   free for everyone
 *  - `false`  Pro only
 *  - number   free up to this many (per day for 'lessons'; total for the others)
 */
export const FREE_LIMITS: Record<Feature, boolean | number> = {
  daily_puzzle: true,
  lessons: 1, // 1 new lesson per day...
  practice_mode: false,
  screener_presets_all: false, // FREE_SCREENER_PRESET_IDS stay open
  saved_screens: 3,
  xray: false,
  compare: false,
  money_accounts: 1, // 1 linked institution (MONEY_HUB_RESEARCH §cost-control lever 1)
  money_alerts: false,
  personal_10k: false,
  articles_pro: false,
  ad_free: false,
};

export const LESSON_RULES = {
  /** ...except during the first N local days after install: unlimited lessons to build the habit. */
  unlimitedFirstDays: 3,
  /** Units that are always free in full (PRODUCT_STRATEGY: "Full Unit 1 (margins)"). */
  alwaysFreeUnitIds: ['u1-margins'] as string[],
  /** Replaying a completed lesson never counts against the daily limit. */
  replaysFree: true,
};

/** Preset screener screens free users can run. Others show a ProGate. Empty = all free. */
export const FREE_SCREENER_PRESET_IDS: string[] = [];
/** How many presets (from the start of PRESET_SCREENS) free users get when the list above is empty. */
export const FREE_SCREENER_PRESET_COUNT = 3;

/** Paywall benefit bullets (keep to 6). */
export const PRO_BENEFITS: { title: string; detail: string }[] = [
  { title: 'Unlimited lessons', detail: 'Every unit, including DCF, ROIC and cyclicality. No daily cap.' },
  { title: 'Practice mode', detail: 'Drill any company with questions built from its filings.' },
  { title: 'Every screen, saved', detail: 'All presets and unlimited saved screens.' },
  { title: 'Fund X-ray & compare', detail: 'See what a fund really holds and chart companies side by side.' },
  { title: 'Money hub, all accounts', detail: 'Link every account, get due-date alerts and your personal 10-K report.' },
  { title: 'No ads', detail: 'Pro is always ad-free.' },
];

// ---------------------------------------------------------------------------------------------
// Ads
// ---------------------------------------------------------------------------------------------

export type AdPlacement = 'article_end' | 'screener_results' | 'heart_refill';
export type AdFormat = 'banner' | 'native' | 'rewarded';

/**
 * Screen contexts. An AdSlot declares where it is; the rules in src/monetization/adRules.ts
 * refuse FORBIDDEN_AD_CONTEXTS no matter what the placement says.
 */
export type AdContext =
  | 'article'
  | 'screener'
  | 'hearts_empty'
  | 'lesson'
  | 'practice'
  | 'money_hub'
  | 'bank_linking'
  | 'personal_finance'
  | 'paywall'
  | 'onboarding'
  | 'other';

/**
 * Why these are forbidden:
 *  - money_hub / bank_linking / personal_finance: screens with the user's own balances and bills.
 *    Ads there read as endorsement, invite lenders to target people who are short on cash, and
 *    ad SDKs next to financial data is a GLBA/Safeguards and App Review risk.
 *  - lesson / practice: never interrupt learning (no interstitials, no banners mid-question).
 *  - paywall / onboarding: ads next to a purchase decision are confusing and cheapen the brand.
 */
export const FORBIDDEN_AD_CONTEXTS: AdContext[] = [
  'money_hub',
  'bank_linking',
  'personal_finance',
  'lesson',
  'practice',
  'paywall',
  'onboarding',
];

export type AdPlacementConfig = {
  format: AdFormat;
  /** The only contexts this placement may appear in. */
  allowedContexts: AdContext[];
  maxPerDay: number;
  /** Minimum minutes between two impressions of this placement. */
  minIntervalMinutes: number;
  /** screener_results: one slot after every N result rows, at most maxPerScreen per list. */
  everyNRows?: number;
  maxPerScreen?: number;
  /** Only shown after an explicit user tap (rewarded). */
  userInitiatedOnly?: boolean;
};

export const AD_PLACEMENTS: Record<AdPlacement, AdPlacementConfig> = {
  article_end: { format: 'native', allowedContexts: ['article'], maxPerDay: 10, minIntervalMinutes: 0 },
  screener_results: {
    format: 'banner',
    allowedContexts: ['screener'],
    maxPerDay: 20,
    minIntervalMinutes: 0,
    everyNRows: 8,
    maxPerScreen: 2,
  },
  heart_refill: {
    format: 'rewarded',
    allowedContexts: ['hearts_empty'],
    maxPerDay: 3,
    minIntervalMinutes: 10,
    userInitiatedOnly: true,
  },
};

/** Global cap across all placements (per local day). */
export const ADS_MAX_IMPRESSIONS_PER_DAY = 25;

/**
 * AdMob unit ids. Defaults are Google's official TEST ids (safe in dev). Production ids come from
 * EXPO_PUBLIC_ADMOB_* env vars. Never click your own live ads.
 */
export const AD_UNIT_IDS = {
  ios: {
    banner: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER ?? 'ca-app-pub-3940256099942544/2934735716',
    native: process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE ?? 'ca-app-pub-3940256099942544/3986624511',
    rewarded: process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED ?? 'ca-app-pub-3940256099942544/1712485313',
  },
  android: {
    banner: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER ?? 'ca-app-pub-3940256099942544/6300978111',
    native: process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE ?? 'ca-app-pub-3940256099942544/2247696110',
    rewarded: process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED ?? 'ca-app-pub-3940256099942544/5224354917',
  },
};

// ---------------------------------------------------------------------------------------------
// Affiliate (disabled by default via FLAGS.affiliateEnabled)
// ---------------------------------------------------------------------------------------------

export type OfferCategory =
  | 'brokerage'
  | 'roth_ira'
  | 'hysa'
  | 'books'
  | 'education'
  // Listed so the validator can name them; ALWAYS rejected:
  | 'credit_card'
  | 'loan'
  | 'cash_advance';

/** Categories we never promote (MONEY_HUB_RESEARCH §4: no credit, lending or EWA/cash advances). */
export const BANNED_OFFER_CATEGORIES: OfferCategory[] = ['credit_card', 'loan', 'cash_advance'];

/** Affiliate offers only ever appear inside articles. Never in Money hub verdicts. */
export type OfferPlacement = 'article_inline' | 'article_end';

export type AffiliateOffer = {
  id: string;
  partner: string;
  category: OfferCategory;
  headline: string;
  body: string;
  cta: string;
  url: string;
  /** Plain-language disclosure; shown under the card. */
  disclosure: string;
  placements: OfferPlacement[];
  /** Only show in articles tagged with one of these topics (e.g. 'roth-ira'). Empty = any article. */
  articleTags?: string[];
};

export const AFFILIATE_DISCLOSURE_DEFAULT =
  'Sponsored. Tenbagger may earn a commission if you open an account. This does not change what we teach, and it is not a recommendation.';

export const AFFILIATE_OFFERS: AffiliateOffer[] = [
  {
    id: 'roth-ira-compare-placeholder',
    partner: 'Example Broker (placeholder)',
    category: 'roth_ira',
    headline: 'Where to open a Roth IRA',
    body: 'Compare account minimums, fees and fund choices before you open one. Look for $0 minimums and low-cost index funds.',
    cta: 'See the comparison',
    url: 'https://example.com/roth-ira',
    disclosure: AFFILIATE_DISCLOSURE_DEFAULT,
    placements: ['article_end'],
    articleTags: ['roth-ira', 'retirement'],
  },
];

// ---------------------------------------------------------------------------------------------
// Legal / store links (placeholders until the LLC's site is live)
// ---------------------------------------------------------------------------------------------

export const LEGAL = {
  termsUrl: 'https://tenbagger.app/terms',
  privacyUrl: 'https://tenbagger.app/privacy',
  manageSubscriptionIos: 'https://apps.apple.com/account/subscriptions',
  manageSubscriptionAndroid: 'https://play.google.com/store/account/subscriptions',
  studentVerificationUrl: 'https://tenbagger.app/student',
};

/** RevenueCat public SDK keys (NOT secrets). Absent → MockPurchasesAdapter. */
export const RC_KEYS = {
  ios: process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '',
  android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '',
};
