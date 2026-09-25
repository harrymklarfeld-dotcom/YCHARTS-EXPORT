/**
 * Paywall price formatting and required purchase disclosures. PURE.
 * Store prices (from RevenueCat) always win over the display fallbacks in config.
 */
import { PLANS, type BillingPeriod, type PlanId } from '../config/monetization';

export type PlanPrice = {
  planId: PlanId;
  /** Numeric price in `currency`. */
  amount: number;
  currency: string;
  /** Store-formatted string when available (already localized), else our own formatting. */
  priceString: string;
  period: BillingPeriod;
  trialDays: number;
};

export function formatMoney(amount: number, currency = 'USD', locale = 'en-US'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency === 'USD' ? '$' : `${currency} `}${amount.toFixed(2)}`;
  }
}

/** Round DOWN to the cent so a per-month equivalent never overstates the saving. */
export function perMonth(amount: number, period: BillingPeriod): number {
  const raw = period === 'year' ? amount / 12 : amount;
  return Math.floor(raw * 100 + 1e-9) / 100;
}

export function periodLabel(period: BillingPeriod, style: 'short' | 'long' = 'short'): string {
  if (style === 'long') return period === 'year' ? 'year' : 'month';
  return period === 'year' ? 'yr' : 'mo';
}

/** "Save 48%" vs paying monthly for 12 months. Floors so we never overclaim. */
export function annualSavingsPercent(annual: number, monthly: number): number {
  if (monthly <= 0) return 0;
  const pct = (1 - annual / (monthly * 12)) * 100;
  return Math.max(0, Math.floor(pct + 1e-9));
}

/** Price from config when the store has not answered (web, mock, offline). */
export function fallbackPrice(planId: PlanId): PlanPrice {
  const p = PLANS[planId];
  return {
    planId,
    amount: p.displayPriceUsd,
    currency: 'USD',
    priceString: formatMoney(p.displayPriceUsd),
    period: p.period,
    trialDays: p.trialDays,
  };
}

export type PlanCardCopy = {
  headline: string; // "$79.99/yr"
  subline: string; // "$6.66/mo, billed yearly"
  badge?: string; // "7-day free trial · Save 48%"
  cta: string;
};

export function planCardCopy(price: PlanPrice, monthlyReference?: PlanPrice): PlanCardCopy {
  const headline = `${price.priceString}/${periodLabel(price.period)}`;
  const monthlyEq = formatMoney(perMonth(price.amount, price.period), price.currency);
  const subline = price.period === 'year' ? `${monthlyEq}/mo, billed yearly` : 'Billed monthly · cancel anytime';
  const badges: string[] = [];
  if (price.trialDays > 0) badges.push(`${price.trialDays}-day free trial`);
  if (price.period === 'year' && monthlyReference && monthlyReference.currency === price.currency) {
    const save = annualSavingsPercent(price.amount, monthlyReference.amount);
    if (save > 0) badges.push(`Save ${save}%`);
  }
  const cta = price.trialDays > 0 ? `Start ${price.trialDays}-day free trial` : `Subscribe for ${headline}`;
  return { headline, subline, badge: badges.length ? badges.join(' · ') : undefined, cta };
}

/** "Free for 7 days, then $79.99/year. Cancel before Oct 2 and you won't be charged." */
export function trialTerms(price: PlanPrice, now: Date = new Date(), locale = 'en-US'): string | null {
  if (price.trialDays <= 0) return null;
  const end = new Date(now.getTime() + price.trialDays * 86_400_000);
  let endStr: string;
  try {
    endStr = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(end);
  } catch {
    endStr = end.toDateString();
  }
  return `Free for ${price.trialDays} days, then ${price.priceString}/${periodLabel(price.period, 'long')}. Cancel before ${endStr} and you won't be charged. We'll remind you 2 days before the trial ends.`;
}

/**
 * Auto-renewal disclosure. Apple (Guideline 3.1.2 + Schedule 2) and Google Play require the
 * price, period, auto-renew terms and how to cancel to be shown clearly before purchase.
 */
export function autoRenewDisclosure(platform: 'ios' | 'android' | 'web' | string): string {
  const store = platform === 'android' ? 'Google Play' : 'Apple ID';
  const manage =
    platform === 'android'
      ? 'Manage or cancel anytime in Google Play > Payments & subscriptions.'
      : 'Manage or cancel anytime in your App Store account settings.';
  return (
    `Payment is charged to your ${store} account at confirmation of purchase (or when a free trial ends). ` +
    'Subscriptions renew automatically at the same price and period unless canceled at least 24 hours before the end of the current period. ' +
    'Your account is charged for renewal within 24 hours before the current period ends. ' +
    `${manage} Any unused part of a free trial is forfeited when you buy a subscription.`
  );
}
