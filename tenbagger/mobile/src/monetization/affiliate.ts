/**
 * Affiliate offers: validation + selection. PURE.
 *
 * Rules:
 *  - Disabled unless FLAGS.affiliateEnabled.
 *  - Only in articles ('article_inline' | 'article_end'); never in Money hub verdicts, lessons,
 *    the screener or anything showing the user's own finances.
 *  - Never credit cards, loans or cash advances (MONEY_HUB_RESEARCH §4; FTC actions against
 *    Brigit/Dave/Cleo). The validator rejects them even if someone adds one to config.
 *  - Every card carries a visible "Sponsored" label and a plain-language disclosure (FTC
 *    Endorsement Guides, 16 CFR 255).
 *  - Hidden for Pro users too, to keep the paid experience clean.
 */
import {
  AFFILIATE_OFFERS,
  BANNED_OFFER_CATEGORIES,
  FLAGS,
  type AffiliateOffer,
  type OfferPlacement,
} from '../config/monetization';
import type { Tier } from './entitlements';

const ALLOWED_PLACEMENTS: OfferPlacement[] = ['article_inline', 'article_end'];
const BANNED_WORDS = /\b(cash advance|payday|loan|credit card|borrow|guaranteed returns?|get rich)\b/i;

export type OfferValidation = { ok: true } | { ok: false; errors: string[] };

export function validateOffer(o: AffiliateOffer): OfferValidation {
  const errors: string[] = [];
  if (!o.id) errors.push('missing id');
  if (BANNED_OFFER_CATEGORIES.includes(o.category)) errors.push(`banned category '${o.category}'`);
  if (BANNED_WORDS.test(`${o.headline} ${o.body} ${o.cta}`)) errors.push('copy mentions credit, loans, cash advances or return promises');
  if (!o.disclosure || o.disclosure.trim().length < 20) errors.push('missing disclosure');
  if (!/sponsored|commission|affiliate/i.test(o.disclosure ?? '')) errors.push('disclosure must say it is sponsored / a commission');
  if (!/^https:\/\//.test(o.url)) errors.push('url must be https');
  if (!o.placements.length) errors.push('no placements');
  for (const p of o.placements) if (!ALLOWED_PLACEMENTS.includes(p)) errors.push(`placement '${p}' not allowed (articles only)`);
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function validateOffers(offers: AffiliateOffer[] = AFFILIATE_OFFERS): { valid: AffiliateOffer[]; rejected: { id: string; errors: string[] }[] } {
  const valid: AffiliateOffer[] = [];
  const rejected: { id: string; errors: string[] }[] = [];
  for (const o of offers) {
    const r = validateOffer(o);
    if (r.ok) valid.push(o);
    else rejected.push({ id: o.id, errors: r.errors });
  }
  return { valid, rejected };
}

export function offersFor(
  placement: OfferPlacement,
  opts: { tier: Tier; articleTags?: string[]; enabled?: boolean; offers?: AffiliateOffer[] },
): AffiliateOffer[] {
  if (!(opts.enabled ?? FLAGS.affiliateEnabled)) return [];
  if (opts.tier === 'pro') return [];
  if (!ALLOWED_PLACEMENTS.includes(placement)) return [];
  const tags = new Set(opts.articleTags ?? []);
  return validateOffers(opts.offers).valid.filter(
    (o) => o.placements.includes(placement) && (!o.articleTags?.length || o.articleTags.some((t) => tags.has(t))),
  );
}
