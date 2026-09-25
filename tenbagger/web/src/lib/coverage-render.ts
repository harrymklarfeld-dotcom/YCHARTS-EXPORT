/**
 * "Can I cover the card?" demo. `renderCoverage` is shared by the server render
 * (Astro) and the browser island, so both show exactly the same numbers.
 * Uses the real @tenbagger/money engine.
 */
import { coverageCheck, formatUSD, shortDate, LABEL_TEXT, type NumberLabel } from '../../../packages/money/src/index.ts';
import { buildScenario, persona, type DemoInputs } from '../data/persona.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function chip(basis: NumberLabel): string {
  return `<span class="md-chip md-${basis}">${esc(LABEL_TEXT[basis] ?? basis)}</span>`;
}

export function renderCoverage(inp: DemoInputs): string {
  const { snapshot, streams } = buildScenario(inp);
  const r = coverageCheck(snapshot, streams, persona.horizonDays, { dailySpend: inp.dailySpend });
  const d = r.dues[0];
  if (!d) return `<p>Nothing due in the next ${persona.horizonDays} days.</p>`;
  const pending = inp.countPending ? 0 : d.pendingIncomeBefore;
  const afterFull = d.afterPayInFull - pending;
  const afterMin = d.afterMinimum - pending;
  const verdict = afterFull >= 0 ? 'covered' : afterMin >= 0 ? 'minimum' : 'short';
  const when = shortDate(d.dueDate);
  const status =
    verdict === 'covered'
      ? { cls: 'ok', icon: '✓', title: `Covered, ${formatUSD(afterFull)} to spare`, sub: `Card due ${when} · ${d.daysAway} days away` }
      : verdict === 'minimum'
        ? { cls: 'amber', icon: '!', title: `${formatUSD(-afterFull)} short of paying in full`, sub: `The ${formatUSD(d.minimumDue)} minimum is covered · due ${when}` }
        : { cls: 'red', icon: '×', title: `${formatUSD(-afterMin)} short, even for the minimum`, sub: `Card due ${when}` };

  const steps = d.steps.filter((s) => !(pending && s.basis === 'pending') && s.op !== '=');
  const rows = steps
    .map(
      (s) =>
        `<li><span class="md-op">${s.op}</span><span class="md-lbl">${esc(s.label)} ${chip(s.basis)}</span><span class="md-amt">${formatUSD(Math.abs(s.amount))}</span></li>`,
    )
    .join('');
  const total = `<li class="md-total"><span class="md-op">=</span><span class="md-lbl">${afterFull >= 0 ? 'Left after paying in full' : 'Short of paying in full'}</span><span class="md-amt">${formatUSD(afterFull)}</span></li>`;

  let nudge = '';
  if (d.pendingIncomeBefore > 0 && inp.countPending) {
    const without = d.afterPayInFull - d.pendingIncomeBefore;
    nudge =
      without < 0
        ? `<p class="md-nudge"><strong>This depends on your ${persona.pendingHours} logged hours.</strong> Submit them before payday (${shortDate(d.depositsBefore[0]?.date ?? d.dueDate)}); without that ${formatUSD(d.pendingIncomeBefore)}, you'd be ${formatUSD(-without)} short of the full balance.</p>`
        : `<p class="md-nudge">Covered even if the ${formatUSD(d.pendingIncomeBefore)} of pending pay is late.</p>`;
  } else if (!inp.countPending && d.pendingIncomeBefore > 0) {
    nudge = `<p class="md-nudge">Conservative mode: ${formatUSD(d.pendingIncomeBefore)} of pay for unsubmitted hours is left out.</p>`;
  }
  if (verdict !== 'covered' && d.apr) {
    nudge += `<p class="md-nudge small">Whatever isn't paid by ${when} would carry interest at ${(d.apr * 100).toFixed(2)}% APR. Options to consider: pay the minimum now and the rest after the ${shortDate(r.deposits.find((x) => x.date > d.dueDate)?.date ?? d.dueDate)} paycheck, or move money from savings.</p>`;
  }

  return `
    <div class="md-status md-${status.cls}" role="status">
      <span class="md-icon" aria-hidden="true">${status.icon}</span>
      <div><p class="md-title">${esc(status.title)}</p><p class="md-sub">${esc(status.sub)}</p></div>
    </div>
    <ol class="md-steps" aria-label="How we got there">${rows}${total}</ol>
    ${nudge}
    <p class="md-asof small">As of ${shortDate(r.asOf)} (sample dates). Expected pay is not guaranteed. Nothing here is a promise that a payment will clear.</p>`;
}
