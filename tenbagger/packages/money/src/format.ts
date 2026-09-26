import type { NumberLabel } from './types.ts';

/** Round to cents without binary-float drift (1.005 → 1.01). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function groupThousands(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * "$1,250", "−$200", "$15.50" (cents only when asked). No Intl, so Hermes and Node match.
 */
export function formatUSD(n: number, opts: { cents?: boolean; signed?: boolean } = {}): string {
  if (!Number.isFinite(n)) return '—';
  const neg = n < 0;
  const abs = Math.abs(n);
  const body = opts.cents
    ? (() => {
        const [i, f] = round2(abs).toFixed(2).split('.');
        return `${groupThousands(i ?? '0')}.${f ?? '00'}`;
      })()
    : groupThousands(String(Math.round(abs)));
  const sign = neg && body.replace(/[0,.]/g, '') !== '' ? '−' : opts.signed && n > 0 ? '+' : '';
  return `${sign}$${body}`;
}

export function formatPct(ratio: number, digits = 0): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatRatio(r: number | null, digits = 2): string {
  if (r === null || !Number.isFinite(r)) return '—';
  return r.toFixed(digits);
}

/** Uppercase chip text for a number label. */
export const LABEL_TEXT: Record<NumberLabel, string> = {
  verified: 'VERIFIED',
  manual: 'MANUAL',
  projected: 'PROJECTED',
  pending: 'PENDING',
  estimate: 'ESTIMATE',
};

const STRENGTH: Record<NumberLabel, number> = { verified: 4, manual: 3, projected: 2, pending: 1, estimate: 0 };

/** A number derived from several inputs is only as trustworthy as its weakest input. */
export function weakestLabel(labels: readonly NumberLabel[]): NumberLabel {
  let out: NumberLabel = 'verified';
  for (const l of labels) if (STRENGTH[l] < STRENGTH[out]) out = l;
  return out;
}
