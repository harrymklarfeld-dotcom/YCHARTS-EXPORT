/**
 * Build a practice set for one ticker.
 * 1) Every lesson question whose `source.ticker` matches.
 * 2) Topped up with questions generated DETERMINISTICALLY from that company's contract data
 *    (no invented numbers — each answer is read straight from companies.json).
 */
import type { Company, Lesson, Question, Unit } from '../types/contract';
import { formatPercent, formatUsdCompact } from './format';

export function lessonQuestionsForTicker(units: Unit[], ticker: string): Question[] {
  const out: Question[] = [];
  for (const u of units) for (const l of u.lessons) for (const q of l.questions) {
    if (q.source?.ticker?.toUpperCase() === ticker.toUpperCase()) out.push(q);
  }
  return out;
}

export function generatedQuestions(c: Company): Question[] {
  const f = c.fundamentals;
  const m = c.metrics;
  const src = (metrics: string[], formula: string) => ({ ticker: c.ticker, fy: c.latest_fy, metrics, formula });
  const qs: Question[] = [];
  if (f.revenue && f.gross_profit !== null && m.gross_margin !== null) {
    qs.push({
      id: `gen-${c.ticker}-gm`, type: 'numeric', unit: 'percent', tolerance: 0.005, answer: m.gross_margin,
      prompt: `${c.name}: revenue ${formatUsdCompact(f.revenue)}, gross profit ${formatUsdCompact(f.gross_profit)}. Gross margin in %?`,
      explanation: `Gross margin = gross profit / revenue = ${formatPercent(m.gross_margin)}.`,
      source: src(['gross_margin'], 'gross_profit / revenue'),
    });
  }
  if (m.net_margin !== null && f.net_income !== null) {
    qs.push({
      id: `gen-${c.ticker}-profit`, type: 'true_false', unit: 'none', answer: f.net_income > 0,
      prompt: `True or false: ${c.ticker} was profitable (positive net income) in FY${c.latest_fy}.`,
      explanation: `Net income was ${formatUsdCompact(f.net_income)}, a net margin of ${formatPercent(m.net_margin)}.`,
      source: src(['net_income'], 'net_income'),
    });
  }
  if (f.operating_cash_flow !== null && f.capex !== null && f.free_cash_flow !== null) {
    qs.push({
      id: `gen-${c.ticker}-fcf`, type: 'numeric', unit: 'usd', answer: f.free_cash_flow,
      tolerance: Math.max(Math.abs(f.free_cash_flow) * 0.02, 1e7),
      prompt: `${c.ticker}: operating cash flow ${formatUsdCompact(f.operating_cash_flow)}, capex ${formatUsdCompact(f.capex)}. Free cash flow?`,
      explanation: `FCF = operating cash flow − capex = ${formatUsdCompact(f.free_cash_flow, 2)}.`,
      source: src(['free_cash_flow'], 'operating_cash_flow - capex'),
    });
  }
  const margins: [string, number | null][] = [
    ['Gross margin', m.gross_margin],
    ['Operating margin', m.operating_margin],
    ['Net margin', m.net_margin],
  ];
  if (margins.every(([, v]) => v !== null)) {
    const idx = [0, 1, 2].sort((a, b) => (margins[b][1] as number) - (margins[a][1] as number));
    qs.push({
      id: `gen-${c.ticker}-order`, type: 'order', unit: 'percent',
      choices: margins.map(([l]) => l), answer: idx,
      prompt: `Rank ${c.ticker}'s margins, highest first.`,
      explanation: margins.map(([l, v]) => `${l} ${formatPercent(v)}`).join(', ') + '. Each step down subtracts another layer of costs.',
      source: src(['gross_margin', 'operating_margin', 'net_margin'], 'x / revenue'),
    });
  }
  return qs;
}

/** A synthetic lesson for the "Practice with this company" button. */
export function practiceLessonFor(c: Company, units: Unit[], max = 6): Lesson {
  const fromLessons = lessonQuestionsForTicker(units, c.ticker);
  const seen = new Set(fromLessons.map((q) => q.id));
  const all = [...fromLessons, ...generatedQuestions(c).filter((q) => !seen.has(q.id))].slice(0, max);
  return {
    id: `practice-${c.ticker}`,
    title: `Practice: ${c.ticker}`,
    xp: 0,
    intro: `# ${c.name}\n\nQuick reps using **${c.ticker}'s FY${c.latest_fy}** numbers. Every answer comes straight from the company's reported financials.\n\n- Revenue: **${formatUsdCompact(c.fundamentals.revenue)}**\n- Net income: **${formatUsdCompact(c.fundamentals.net_income)}**`,
    questions: all,
  };
}
