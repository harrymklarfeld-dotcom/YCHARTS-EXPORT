# Customizing the website

Almost everything lives in **one file: `site.config.ts`**. Change a value, save, and the
whole site follows. You don't need to know Astro to do it.

```bash
cd tenbagger/web
npm install          # once
npm run dev          # live preview at http://localhost:4321 (reloads as you edit)
npm run build        # builds the static site into dist/
npm run check:links  # checks every internal link in dist/
npm run serve        # serves dist/ at http://localhost:4321 (to test the real build)
npm run screenshots  # desktop + mobile PNGs into ../docs/screenshots (needs Playwright)
npm run og           # re-renders public/og.png (the social-share card) from the config
```

Upload the `dist/` folder to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3).

## The 20 most likely edits

| # | I want to change… | Edit this |
|---|---|---|
| 1 | The product name everywhere | `site.config.ts` → `name` (then `npm run og`) |
| 2 | The logo letters | `site.config.ts` → `logoMark`. The browser-tab icon is `public/favicon.svg` (plain text; change the letters and colors inside it) |
| 3 | The big headline / sub-headline on the home page | `site.config.ts` → `heroLine`, `heroSub` |
| 4 | The tagline (footer, search-engine description) | `site.config.ts` → `tagline` |
| 5 | Brand color | `site.config.ts` → `colors.light.accent` **and** `colors.dark.accent` (keep `accentInk` readable on it) |
| 6 | Any other color (background, text, highlights) | `site.config.ts` → `colors.light` / `colors.dark`. Each key has a comment |
| 7 | Fonts | `site.config.ts` → `fonts.display` / `fonts.body` / `fonts.mono`. Use exact Google Fonts names, e.g. `'Inter'`, weights like `'400;600'` |
| 8 | Header menu links | `site.config.ts` → `nav` (label + href) |
| 9 | Footer links | `site.config.ts` → `footerLinks` |
| 10 | Social icons/links | `site.config.ts` → `social` (empty string hides one) |
| 11 | Prices, plan names, plan features | `site.config.ts` → `pricing.tiers` (and `pricing.note` for the small print) |
| 12 | Hide pricing / waitlist / money hub / demo lesson | `site.config.ts` → `features.showPricing`, `showWaitlist`, `showMoneyHub`, `showDemoLesson` |
| 13 | Send waitlist sign-ups to a real service | `site.config.ts` → `waitlist.endpoint` (any URL that accepts a JSON POST `{ email, source }`, e.g. Formspree). Empty = saved in the visitor's browser only |
| 14 | Waitlist wording | `site.config.ts` → `waitlist.heading`, `sub`, `button`, `successMessage` |
| 15 | FAQ questions and answers | `site.config.ts` → `faq` |
| 16 | Disclaimer text (footer + /legal/disclaimer) | `site.config.ts` → `disclaimer`, `disclaimerShort`; longer legal copy in `src/pages/legal/disclaimer.astro` and `privacy.astro` |
| 17 | The domain used in links, sitemap and share cards | `site.config.ts` → `url` (no trailing slash) |
| 18 | Which lesson plays on the home page | `site.config.ts` → `demo.lessonId` (an id from `data/lessons.json`, e.g. `u5-l4`) and `demo.questions` |
| 19 | Embed the web version of the app at /app | `site.config.ts` → `appUrl` (see the note on the /app page) |
| 20 | The fictional person in the "Can I cover the card?" demo | `src/data/persona.ts` (name, pay, card balance, due date) |

## Where things come from

| Content | Source (read at build time) |
|---|---|
| Company pages `/companies/<ticker>/` | `../data/companies.json` (one page per company, automatically) |
| Metric pages `/metrics/<metric>/` | the screener package catalog `../packages/screener/src/catalog.ts` |
| Articles `/learn/<slug>/` | `../content/articles/*.md` (+ widget spec `../content/widgets.json`). Missing folder = a friendly placeholder |
| Lessons in the demo and "practice" boxes | `../data/lessons.json` |
| Screener presets and query language | `../packages/screener/src` |
| Money hub math | `../packages/money/src` |

Rebuild (`npm run build`) after any of these change. Paths are configurable in `site.config.ts → data`.

## Slightly deeper edits

- **Page text** is in `src/pages/*.astro`. Each file is mostly HTML; text between tags is safe to edit.
- **Section order on the home page:** move the `<section>` blocks in `src/pages/index.astro`.
- **Global styles** (spacing, buttons, tables): `src/styles/global.css`. Widget styles: `src/styles/widgets.css`.
- **Add an article widget type:** add a component in `src/components/widgets/` and one line in `Widget.astro`.
- **Honesty banners** ("Sample data", "Sample price") appear automatically from `companies.json`
  (`source`, `price_is_sample`) and `content/widgets.json → provenance`. Don't remove them while data is sample.
