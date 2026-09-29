/**
 * Revenue-funnel analytics. No vendor: events go to pluggable sinks (console in dev).
 * Plug in PostHog/Amplitude/etc. later with addAnalyticsSink(). NEVER send personal financial
 * data (balances, amounts, account names): props are restricted to primitives and a denylist
 * of money-ish keys is stripped.
 */
export type MonetizationEvent =
  | 'paywall_view'
  | 'paywall_dismiss'
  | 'paywall_blocked_in_lesson'
  | 'plan_selected'
  | 'trial_start'
  | 'purchase'
  | 'purchase_cancelled'
  | 'purchase_failed'
  | 'restore'
  | 'gate_hit'
  | 'ad_impression'
  | 'ad_failed'
  | 'rewarded_earned'
  | 'offer_impression'
  | 'offer_click';

export type EventProps = Record<string, string | number | boolean | null | undefined>;
export type AnalyticsSink = (event: MonetizationEvent, props: EventProps, at: number) => void;

const DENY = /balance|amount|account_?(name|number|id)|bank|income|salary|email|full_?name/i;

const consoleSink: AnalyticsSink = (event, props) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.log(`[analytics] ${event}`, props);
};

let sinks: AnalyticsSink[] = [consoleSink];

export function addAnalyticsSink(sink: AnalyticsSink): () => void {
  sinks.push(sink);
  return () => {
    sinks = sinks.filter((s) => s !== sink);
  };
}

/** Test helper: replace all sinks (pass [] to silence). */
export function setAnalyticsSinks(next: AnalyticsSink[]) {
  sinks = [...next];
}

export function sanitize(props: EventProps): EventProps {
  const out: EventProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (DENY.test(k) && k !== 'price_amount') continue;
    if (v === null || v === undefined || ['string', 'number', 'boolean'].includes(typeof v)) out[k] = v;
  }
  return out;
}

export function track(event: MonetizationEvent, props: EventProps = {}): void {
  const clean = sanitize(props);
  const at = Date.now();
  for (const s of sinks) {
    try {
      s(event, clean, at);
    } catch {
      // a broken sink must never break the app
    }
  }
}
