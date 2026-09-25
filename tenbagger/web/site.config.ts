/**
 * ============================================================================
 *  SITE CONFIG — the one file you edit to rebrand or reconfigure the website.
 * ============================================================================
 *
 *  Every page, component and interactive widget reads from this object.
 *  Change the brand name, colors or fonts here and the whole site follows.
 *  See CUSTOMIZE.md for a "change X → edit Y" table.
 *
 *  After editing: run `npm run dev` to preview, `npm run build` to publish.
 */

export const site = {
  // ---------------------------------------------------------------- brand
  /** Shown in the header, page titles, footer and social cards. */
  name: 'Tenbagger',
  /** Short line under the logo and in <meta name="description"> on the home page. */
  tagline: 'Learn to read any public company’s numbers, 3 minutes a day.',
  /** The big hero promise on the landing page. Keep it one sentence. */
  heroLine: 'Learn to read any public company’s numbers, 3 minutes a day.',
  /** The smaller line under the hero. */
  heroSub:
    'Bite-size drills built from real SEC filings, never stock tips. Then read your own money the way analysts read a 10-K.',
  /** Two or three letters used in the square logo mark. */
  logoMark: 'TB',

  /** Public URL of the deployed site, no trailing slash. Used for canonical links, sitemap and OG tags. */
  url: 'https://tenbagger.example',
  /** Default language of the pages. */
  lang: 'en',

  // ---------------------------------------------------------------- colors
  /**
   * Design tokens. `light` and `dark` must define the same keys.
   * The site follows the visitor's system theme; the header toggle overrides it.
   */
  colors: {
    light: {
      bg: '#F5F1E8', // page background (warm paper)
      surface: '#FFFDF8', // cards
      surface2: '#ECE6D8', // subtle panels, table stripes
      ink: '#15171A', // main text
      muted: '#5B5E63', // secondary text (4.5:1 on bg)
      rule: '#D6CEBD', // borders and hairlines
      accent: '#0E5A3A', // brand color: links, buttons, highlights (ledger green)
      accentInk: '#FFFFFF', // text on accent buttons
      accentSoft: '#DCEBDD', // tinted backgrounds
      signal: '#B8401A', // secondary highlight (numbers you should notice)
      positive: '#11703F',
      negative: '#B3261E',
      warn: '#8A5A00',
      warnSoft: '#F7E7C4',
    },
    dark: {
      bg: '#0F1211',
      surface: '#171B1A',
      surface2: '#1F2523',
      ink: '#ECE8DF',
      muted: '#A3A7A2',
      rule: '#2E3532',
      accent: '#6FD39B',
      accentInk: '#08140E',
      accentSoft: '#1B3327',
      signal: '#F08A5D',
      positive: '#6FD39B',
      negative: '#FF8A80',
      warn: '#F2C46D',
      warnSoft: '#3A2E14',
    },
  },

  // ---------------------------------------------------------------- fonts
  /**
   * Google Fonts family names. The stylesheet link is generated from these.
   * `display` is for headlines, `body` for text, `mono` for numbers and tickers.
   */
  fonts: {
    display: { family: 'Newsreader', weights: '400;600;700', fallback: 'Georgia, serif' },
    body: { family: 'Public Sans', weights: '400;500;600;700', fallback: 'system-ui, sans-serif' },
    mono: { family: 'IBM Plex Mono', weights: '400;500;600', fallback: 'ui-monospace, monospace' },
  },

  // ---------------------------------------------------------------- navigation
  nav: [
    { label: 'Learn', href: '/learn/' },
    { label: 'Companies', href: '/companies/' },
    { label: 'Screener', href: '/screener/' },
    { label: 'Metrics', href: '/metrics/' },
    { label: 'Pricing', href: '/pricing/' },
  ],
  /** The call-to-action button at the right of the header. */
  headerCta: { label: 'Join the waitlist', href: '/#waitlist' },

  footerLinks: [
    { label: 'About', href: '/about/' },
    { label: 'Open the app', href: '/app/' },
    { label: 'Disclaimer', href: '/legal/disclaimer/' },
    { label: 'Privacy', href: '/legal/privacy/' },
    { label: 'Sitemap', href: '/sitemap.xml' },
  ],

  /** Leave a value as '' to hide that icon. */
  social: {
    x: '',
    tiktok: '',
    youtube: '',
    instagram: '',
    github: '',
    email: 'hello@tenbagger.example',
  },

  // ---------------------------------------------------------------- feature flags
  features: {
    /** Show the pricing section on the landing page and the /pricing page link in the nav. */
    showPricing: true,
    /** Show the waitlist sign-up form (landing, footer band, pricing). */
    showWaitlist: true,
    /** Show the money hub ("Can I cover the card?") section and copy. */
    showMoneyHub: true,
    /** Show the playable 3-question lesson on the landing page. */
    showDemoLesson: true,
  },

  // ---------------------------------------------------------------- pricing
  pricing: {
    /** Small print under the plans. */
    note: 'Prices in USD. The renewal price is shown before checkout, and you can cancel in one tap. No weekly intro traps.',
    tiers: [
      {
        id: 'free',
        name: 'Free',
        price: '$0',
        period: 'forever',
        blurb: 'The daily habit, free for good.',
        features: [
          'Full first unit, then 1 lesson a day',
          'Daily Guess-the-Company puzzle',
          '3 screener quests a week',
          'Due-date check for 1 card',
          'Every company & metric page on the web',
        ],
        cta: 'Join the waitlist',
        highlight: false,
      },
      {
        id: 'pro',
        name: 'Pro',
        price: '$12.99',
        period: '/month',
        altPrice: 'or $79.99/year · 7-day trial on annual',
        blurb: 'Everything, unlimited.',
        features: [
          'Unlimited lessons + advanced units (DCF, ROIC, cycles)',
          'Full screener with every filter',
          'Unlimited “My Stocks” lessons',
          'Personal 10-K scorecard with history',
          'Forecast alerts before a bill is due',
        ],
        cta: 'Get early access',
        highlight: true,
      },
      {
        id: 'student',
        name: 'Student',
        price: '$39.99',
        period: '/year',
        altPrice: 'Verified .edu email',
        blurb: 'All of Pro, about half off.',
        features: ['Everything in Pro', 'Interview-prep drills on real companies', 'Club leaderboards (coming soon)'],
        cta: 'Get student access',
        highlight: false,
      },
    ],
  },

  // ---------------------------------------------------------------- waitlist
  waitlist: {
    /**
     * Where the sign-up form POSTs (JSON: { email, source }). Works with Formspree,
     * Buttondown, a Supabase edge function, etc. Leave '' to keep sign-ups in the
     * visitor's browser only and show `localMessage` (good for demos).
     */
    endpoint: '',
    heading: 'Get early access',
    sub: 'One email when the app opens. No spam, no selling your address.',
    button: 'Join the waitlist',
    successMessage: 'You’re on the list. We’ll email you once, when it opens.',
    localMessage: 'Saved on this device. (Sign-ups aren’t connected to a server yet.)',
  },

  // ---------------------------------------------------------------- app
  /** Where the web build of the mobile app lives. '' shows the placeholder page at /app. */
  appUrl: '',

  // ---------------------------------------------------------------- data
  /** Paths are relative to the `web/` folder. */
  data: {
    companies: '../data/companies.json',
    lessons: '../data/lessons.json',
    articlesDir: '../content/articles',
    articlesIndex: '../data/articles.json',
  },

  /** Lesson used for the playable demo on the landing page, and how many questions to play. */
  demo: { lessonId: 'u2-l1', questions: 3 },

  /** Company used on the landing page "plain English" callout. */
  featuredTicker: 'COST',

  // ---------------------------------------------------------------- legal
  disclaimer:
    'Educational content only. Nothing here is investment, tax or legal advice, and nothing is a recommendation to buy, sell or hold any security. Figures come from companies’ SEC filings and may contain errors; share prices marked “sample” are placeholders.',
  /** Short version shown on every page footer. */
  disclaimerShort: 'Education, not investment advice. Never stock tips.',
  companyLegalName: 'Tenbagger (working name)',
  contactEmail: 'hello@tenbagger.example',

  // ---------------------------------------------------------------- FAQ (landing + pricing)
  faq: [
    {
      q: 'Is this investment advice?',
      a: 'No. We teach you how to read financial statements using real companies as examples. We never tell you what to buy, sell or hold, we never give price targets, and screens are study tools, not recommendations.',
    },
    {
      q: 'Where do the numbers come from?',
      a: 'From the annual reports (10-K filings) companies submit to the SEC, pulled through the SEC’s public XBRL data. Every lesson answer is computed from those filings, never made up by an AI.',
    },
    {
      q: 'Do I need to know anything about investing?',
      a: 'No. The first unit starts with “what is revenue?” and every term is explained the first time it appears.',
    },
    {
      q: 'What is the money hub?',
      a: 'A private view of your own finances in the same language as a company report: cash, bills due, pay you have earned but not yet been paid. Its first job is answering “can I cover my card by the due date?” It describes; it never tells you what to do with your money.',
    },
    {
      q: 'Do you lend money or offer cash advances?',
      a: 'No, and we won’t. The hub shows you the numbers; it does not sell you credit.',
    },
    {
      q: 'How much does it cost?',
      a: 'The daily lesson, the puzzle and every web page are free. Pro is $12.99 a month or $79.99 a year; students pay $39.99 a year.',
    },
  ],
} as const;

export type Site = typeof site;
export default site;
