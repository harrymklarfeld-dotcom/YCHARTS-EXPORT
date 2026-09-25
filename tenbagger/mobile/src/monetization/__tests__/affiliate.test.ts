import { AFFILIATE_OFFERS, type AffiliateOffer } from '../../config/monetization';
import { offersFor, validateOffer, validateOffers } from '../affiliate';

const good: AffiliateOffer = {
  id: 'ok',
  partner: 'Broker',
  category: 'roth_ira',
  headline: 'Where to open a Roth IRA',
  body: 'Compare fees and minimums.',
  cta: 'Compare',
  url: 'https://example.com',
  disclosure: 'Sponsored. We may earn a commission.',
  placements: ['article_end'],
  articleTags: ['roth-ira'],
};

describe('affiliate validator', () => {
  it('accepts a compliant educational offer', () => {
    expect(validateOffer(good)).toEqual({ ok: true });
  });
  it.each(['credit_card', 'loan', 'cash_advance'] as const)('rejects category %s', (category) => {
    const r = validateOffer({ ...good, category });
    expect(r.ok).toBe(false);
  });
  it('rejects credit/cash-advance language hidden in another category', () => {
    expect(validateOffer({ ...good, headline: 'Get a cash advance today' }).ok).toBe(false);
  });
  it('requires a sponsored disclosure, https, and article-only placements', () => {
    expect(validateOffer({ ...good, disclosure: '' }).ok).toBe(false);
    expect(validateOffer({ ...good, disclosure: 'This is a great partner we really like a lot.' }).ok).toBe(false);
    expect(validateOffer({ ...good, url: 'http://x.com' }).ok).toBe(false);
    expect(validateOffer({ ...good, placements: ['money_hub' as never] }).ok).toBe(false);
  });
  it('every shipped config offer is valid', () => {
    expect(validateOffers(AFFILIATE_OFFERS).rejected).toEqual([]);
  });
});

describe('offersFor', () => {
  const bad = { ...good, id: 'bad', category: 'cash_advance' as const };
  it('disabled by default flag', () => {
    expect(offersFor('article_end', { tier: 'free', articleTags: ['roth-ira'], offers: [good] })).toEqual([]);
  });
  it('filters banned, pro, tags and placements', () => {
    const o = { enabled: true, offers: [good, bad] };
    expect(offersFor('article_end', { ...o, tier: 'free', articleTags: ['roth-ira'] }).map((x) => x.id)).toEqual(['ok']);
    expect(offersFor('article_end', { ...o, tier: 'free', articleTags: ['margins'] })).toEqual([]);
    expect(offersFor('article_end', { ...o, tier: 'pro', articleTags: ['roth-ira'] })).toEqual([]);
    expect(offersFor('money_hub' as never, { ...o, tier: 'free', articleTags: ['roth-ira'] })).toEqual([]);
  });
});
