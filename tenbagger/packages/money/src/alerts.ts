/**
 * Plain-English alerts for the Overview: what changed or needs attention, ranked. Each one
 * describes a fact and points to the tab that explains it. No advice, no offers.
 */
import { shortDate } from './dates.ts';
import { formatPct, formatUSD } from './format.ts';
import type { CoverageReport } from './coverage.ts';
import type { Utilization } from './credit.ts';
import type { PendingLine } from './series.ts';
import type { Leak, PaymentRebound, Subscription } from './transactions.ts';

export type AlertSeverity = 'high' | 'medium' | 'info';
export type MoneyAlert = { id: string; severity: AlertSeverity; title: string; text: string; tab: string };

export type AlertInput = {
  coverage?: CoverageReport;
  utilization?: Utilization;
  pending?: readonly PendingLine[];
  rebounds?: readonly PaymentRebound[];
  leaks?: readonly Leak[];
  runwayDays?: number | null;
  subscriptions?: readonly Subscription[];
};

const RANK: Record<AlertSeverity, number> = { high: 0, medium: 1, info: 2 };

export function moneyAlerts(i: AlertInput): MoneyAlert[] {
  const out: MoneyAlert[] = [];
  const cov = i.coverage;
  if (cov && cov.verdict !== 'covered') {
    out.push({ id: 'coverage', severity: cov.verdict === 'short' ? 'high' : 'medium', title: 'Card due date check', text: cov.headline, tab: 'credit' });
  }
  for (const p of i.pending ?? []) {
    out.push({ id: `pending-${p.streamId}`, severity: 'high', title: `Unsubmitted ${p.unitWord}`, text: p.reminder, tab: 'income' });
  }
  const lastRebound = [...(i.rebounds ?? [])].reverse().find((r) => r.outrun);
  if (lastRebound) {
    out.push({
      id: 'rebound',
      severity: 'medium',
      title: 'Card paydown outrun',
      text: `After the ${formatUSD(lastRebound.paid)} payment on ${shortDate(lastRebound.date)}, ${formatUSD(lastRebound.chargesAfter)} of new charges followed within two weeks (${formatPct(lastRebound.share)} of the payment).`,
      tab: 'credit',
    });
  }
  const u = i.utilization;
  if (u && u.ratio !== null && u.ratio >= 0.3) {
    out.push({ id: 'utilization', severity: 'medium', title: `Utilization ${formatPct(u.ratio)}`, text: u.sentence, tab: 'credit' });
  }
  if (i.runwayDays !== undefined && i.runwayDays !== null && i.runwayDays < 30) {
    out.push({ id: 'runway', severity: i.runwayDays < 14 ? 'high' : 'medium', title: `Cash covers ${i.runwayDays} days`, text: `At recent spending, checking and savings cover about ${i.runwayDays} days without new income.`, tab: 'bank' });
  }
  const leak = i.leaks?.[0];
  if (leak) out.push({ id: `leak-${leak.category}`, severity: 'info', title: `${leak.title} growing`, text: leak.sentence, tab: 'spending' });
  const subs = i.subscriptions ?? [];
  if (subs.length) {
    const monthly = subs.reduce((s, x) => s + x.monthlyCost, 0);
    out.push({ id: 'subscriptions', severity: 'info', title: `${subs.length} recurring charges`, text: `About ${formatUSD(monthly, { cents: true })} a month (${formatUSD(monthly * 12)} a year) goes to repeating charges.`, tab: 'spending' });
  }
  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}
