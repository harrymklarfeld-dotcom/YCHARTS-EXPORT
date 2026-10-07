import { PLANS } from '../../config/monetization';
import { sanitize, setAnalyticsSinks, track } from '../analytics';
import { annualSavingsPercent, autoRenewDisclosure, fallbackPrice, formatMoney, perMonth, planCardCopy, trialTerms } from '../pricing';

describe('pricing', () => {
  it('config display prices match PRODUCT_STRATEGY', () => {
    expect(PLANS.pro_monthly.displayPriceUsd).toBe(12.99);
    expect(PLANS.pro_annual.displayPriceUsd).toBe(79.99);
    expect(PLANS.pro_annual.trialDays).toBe(7);
    expect(PLANS.pro_monthly.trialDays).toBe(0);
    expect(PLANS.student_annual.displayPriceUsd).toBe(39.99);
  });
  it('formats USD', () => {
    expect(formatMoney(79.99)).toBe('$79.99');
    expect(formatMoney(6.5)).toBe('$6.50');
  });
  it('per-month equivalent rounds down', () => {
    expect(perMonth(79.99, 'year')).toBe(6.66);
    expect(perMonth(39.99, 'year')).toBe(3.33);
    expect(perMonth(12.99, 'month')).toBe(12.99);
  });
  it('savings vs monthly never overclaims', () => {
    expect(annualSavingsPercent(79.99, 12.99)).toBe(48);
    expect(annualSavingsPercent(200, 12.99)).toBe(0);
  });
  it('annual card copy', () => {
    const c = planCardCopy(fallbackPrice('pro_annual'), fallbackPrice('pro_monthly'));
    expect(c.headline).toBe('$79.99/yr');
    expect(c.subline).toBe('$6.66/mo, billed yearly');
    expect(c.badge).toBe('7-day free trial · Save 48%');
    expect(c.cta).toBe('Start 7-day free trial');
  });
  it('monthly card copy', () => {
    const c = planCardCopy(fallbackPrice('pro_monthly'));
    expect(c.headline).toBe('$12.99/mo');
    expect(c.badge).toBeUndefined();
    expect(c.cta).toBe('Subscribe for $12.99/mo');
  });
  it('uses the store price string when present (localized)', () => {
    const c = planCardCopy({ planId: 'pro_annual', amount: 89.99, currency: 'EUR', priceString: '89,99 €', period: 'year', trialDays: 0 });
    expect(c.headline).toBe('89,99 €/yr');
  });
  it('trial terms state the renewal price and the cancel-by date', () => {
    const s = trialTerms(fallbackPrice('pro_annual'), new Date('2026-09-25T12:00:00Z'));
    expect(s).toContain('Free for 7 days, then $79.99/year');
    expect(s).toContain('Oct 2');
    expect(trialTerms(fallbackPrice('pro_monthly'))).toBeNull();
  });
  it('auto-renew disclosure covers the Apple-required points', () => {
    const d = autoRenewDisclosure('ios');
    expect(d).toMatch(/Apple ID/);
    expect(d).toMatch(/renew automatically/);
    expect(d).toMatch(/24 hours/);
    expect(d).toMatch(/cancel/i);
    expect(autoRenewDisclosure('android')).toMatch(/Google Play/);
  });
});

describe('analytics', () => {
  it('strips personal finance fields and delivers to sinks', () => {
    expect(sanitize({ plan: 'pro_annual', balance: 120, bank_name: 'X', price_amount: 79.99 })).toEqual({ plan: 'pro_annual', price_amount: 79.99 });
    const got: string[] = [];
    setAnalyticsSinks([(e) => got.push(e)]);
    track('paywall_view', { source: 'xray' });
    track('purchase', { plan: 'pro_annual' });
    expect(got).toEqual(['paywall_view', 'purchase']);
  });
});
