/**
 * Output panels for the article calculators (pe / dcf / liquidity). Shared by the
 * server render and the <calc-widget> island so both show identical numbers.
 */
import { wfmt, peCalc, dcfCalc, liquidityCalc, GRADE_TEXT } from './wformat.ts';

export type PeState = { kind: 'pe'; price: number; eps: number; requiredReturn: number };
export type DcfState = {
  kind: 'dcf';
  fcf: number;
  normalized: number | null;
  useNormalized: boolean;
  growth: number;
  discount: number;
  terminal: number;
  years: number;
  netCash: number;
  shares: number | null;
  price: number | null;
};
export type LiqState = { kind: 'liquidity'; cash: number; card: number };
export type CalcState = PeState | DcfState | LiqState;

const out = (label: string, value: string, note = '') =>
  `<div class="calc-out"><span class="calc-out-label">${label}</span><span class="calc-out-value">${value}</span>${note ? `<span class="calc-out-note">${note}</span>` : ''}</div>`;

export function renderCalc(s: CalcState): string {
  if (s.kind === 'pe') {
    const r = peCalc(s.price, s.eps, s.requiredReturn);
    return [
      out('P/E', r.pe === null ? 'n/m' : wfmt('multiple', r.pe), r.pe === null ? 'Not meaningful when earnings are zero or negative.' : `You pay ${wfmt('per_share', r.pe)} for each $1 of yearly earnings.`),
      out('Earnings yield', wfmt('percent', r.earningsYield), 'EPS ÷ price: the P/E flipped upside down.'),
      out(
        'Growth the price implies',
        wfmt('percent', r.impliedGrowth),
        `If investors want a ${wfmt('percent', s.requiredReturn)} yearly return, required return ≈ earnings yield + growth.`,
      ),
    ].join('');
  }
  if (s.kind === 'dcf') {
    const f0 = s.useNormalized && s.normalized !== null ? s.normalized : s.fcf;
    const r = dcfCalc({ f0, g: s.growth, r: s.discount, m: s.terminal, n: s.years, netCash: s.netCash, shares: s.shares });
    const perShare = r.perShare !== null ? out('Estimate per share', wfmt('per_share', r.perShare), s.price ? `For reference, the share price in the data is ${wfmt('per_share', s.price)}.` : '') : '';
    return [
      out('Estimated value of the business', wfmt('usd', r.value), `${s.years} years of cash + a ${wfmt('multiple', s.terminal)} exit ${s.netCash >= 0 ? `+ ${wfmt('usd', s.netCash)} net cash` : `− ${wfmt('usd', -s.netCash)} net debt`}.`),
      perShare,
      out('Share of value from the exit multiple', wfmt('percent', r.terminalShare), 'The higher this is, the more the answer rests on a guess about the far future.'),
      `<p class="calc-foot small muted">Starting FCF used: ${wfmt('usd', f0)}${s.useNormalized ? ' (normalized average)' : ''}. An estimate is only as good as its inputs; small slider moves change it a lot.</p>`,
    ].join('');
  }
  const r = liquidityCalc(s.cash, s.card);
  return [
    `<div class="calc-grade calc-grade-${r.grade}"><span class="calc-grade-letter">${r.grade}</span><span>${GRADE_TEXT[r.grade]}</span></div>`,
    out('Liquidity ratio', r.ratio === null ? 'No card balance' : `${r.ratio.toFixed(2)}`, 'Cash ÷ card balance: your personal current ratio.'),
    out('Cash left after paying the card', wfmt('usd', r.cushion)),
  ].join('');
}
