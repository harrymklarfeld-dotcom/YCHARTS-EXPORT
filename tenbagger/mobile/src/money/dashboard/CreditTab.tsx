/**
 * Credit: balance vs limit (utilization with plain-English bands), statement vs due date,
 * minimum vs full payment, a payoff planner, the rebound detector, and interest avoided.
 * Educational only: no card offers, no borrowing products.
 */
import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';
import { LineChart } from '../charts';
import { LabelChip, Money } from '../components';
import { formatPct, formatUSD, minimumOnlyPlan, payoffPlan, shortDate, UTILIZATION_BANDS } from '../engine';
import { CoverCard } from '../sections';
import type { TabProps } from './types';
import { Explainer, Grid, KV, LinkPill, Measure, Panel, pct } from './ui';

export default function CreditTab({ dash, wide }: TabProps) {
  const t = useTheme();
  const c = dash.card;
  const [amount, setAmount] = useState('100');
  const monthly = Number(amount.replace(/[^0-9.]/g, '')) || 0;
  const bal = c.account?.balance ?? 0;
  const apr = c.apr ?? 0;
  const plan = useMemo(() => payoffPlan(bal, apr, monthly), [bal, apr, monthly]);
  const minPlan = useMemo(() => minimumOnlyPlan(bal, apr), [bal, apr]);

  if (!c.account) {
    return (
      <Panel title="No credit card">
        <Text style={{ color: t.c.inkSoft }}>No card in your snapshots.</Text>
      </Panel>
    );
  }
  const u = c.utilization;
  const l = c.liability;
  const bandColor = (id: string) => (id === 'low' ? t.c.primary : id === 'moderate' ? t.c.accent : t.c.danger);
  const lastRebound = [...c.rebounds].reverse().find((r) => r.outrun);

  return (
    <View style={{ gap: 14 }}>
      <Grid wide={wide} min={320}>
        <Panel eyebrow={c.account.name} title="Balance vs limit" right={<LabelChip label={c.account.basis} small />}>
          {u && u.ratio !== null && u.limit ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Money value={bal} size={28} weight="900" />
                <Text style={{ color: t.c.inkSoft }}>of {formatUSD(u.limit)}</Text>
                <Text style={{ marginLeft: 'auto', color: t.c.ink, fontSize: 22, fontWeight: '900' }}>{pct(u.ratio)}</Text>
              </View>
              <View accessibilityRole="progressbar" accessibilityLabel={u.sentence} style={{ height: 16, borderRadius: 8, backgroundColor: t.c.surfaceAlt, overflow: 'hidden' }}>
                <View style={{ width: `${Math.min(100, u.ratio * 100)}%`, height: '100%', backgroundColor: bandColor(u.band!.id), borderRadius: 8 }} />
                {[0.1, 0.3].map((m) => (
                  <View key={m} style={{ position: 'absolute', left: `${m * 100}%`, top: 0, bottom: 0, width: 2, backgroundColor: t.c.surface }} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: t.c.inkSoft, fontSize: 11 }}>10% = {formatUSD(u.at10!)}</Text>
                <Text style={{ color: t.c.inkSoft, fontSize: 11 }}>30% = {formatUSD(u.at30!)}</Text>
                <Text style={{ color: t.c.inkSoft, fontSize: 11 }}>limit {formatUSD(u.limit)}</Text>
              </View>
              {UTILIZATION_BANDS.filter((b) => b.id !== 'over').map((b) => (
                <View key={b.id} style={{ flexDirection: 'row', gap: 8, opacity: b.id === u.band!.id ? 1 : 0.6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 4, backgroundColor: bandColor(b.id) }} />
                  <Text style={{ flex: 1, color: t.c.ink, fontSize: 13, lineHeight: 18 }}>
                    <Text style={{ fontWeight: '800' }}>{b.title}{b.id === u.band!.id ? ' (you are here)' : ''}. </Text>
                    {b.text}
                  </Text>
                </View>
              ))}
              <LinkPill label="Learn: credit utilization" href="/money/learn/utilization" />
            </>
          ) : (
            <Text style={{ color: t.c.inkSoft }}>{u?.sentence ?? 'No limit on record.'}</Text>
          )}
        </Panel>

        {c.cycle ? (
          <Panel eyebrow="How the bill works" title="Statement date vs due date">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <DateBox label="Statement" date={c.cycle.statementDate} color={t.c.ink} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ height: 2, alignSelf: 'stretch', backgroundColor: t.c.line }} />
                <Text style={{ color: t.c.inkSoft, fontSize: 11, marginTop: 4 }}>{c.cycle.graceDays !== null ? `${c.cycle.graceDays}-day grace period` : 'grace period'}</Text>
              </View>
              <DateBox label="Due" date={c.cycle.dueDate} color={t.c.danger} />
            </View>
            {c.cycle.steps.map((s) => (
              <Text key={s} style={{ color: t.c.ink, fontSize: 13, lineHeight: 19 }}>
                • {s}
              </Text>
            ))}
            <LinkPill label="Learn: statement vs due date" href="/money/learn/statement-vs-due" />
          </Panel>
        ) : null}
      </Grid>

      {l ? (
        <Grid wide={wide} min={320}>
          <Panel eyebrow={`Due ${shortDate(l.dueDate)}`} title="Minimum vs full payment" right={<LabelChip label="estimate" small />}>
            <KV label="Pay the full statement" value={formatUSD(l.statementBalance)} strong />
            <KV label="Interest on these purchases" value="$0" color={t.c.primary} />
            <KV label="Pay only the minimum" value={formatUSD(l.minimumDue)} strong />
            <KV label="Interest next month, roughly" value={c.interestAvoided ? formatUSD(c.interestAvoided.perMonth, { cents: true }) : '—'} color={t.c.danger} />
            <KV label="Minimum-only until $0" value={minPlan.months !== null ? `${minPlan.months} months` : '50+ years'} />
            <KV label="Interest if minimum-only" value={formatUSD(minPlan.totalInterest)} color={t.c.danger} />
            {c.interestAvoided ? <Explainer title="Interest avoided by paying in full">{c.interestAvoided.sentence}</Explainer> : null}
            <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{minPlan.sentence} Real cards use a daily rate and their own minimum formula, so actual numbers differ a little.</Text>
          </Panel>

          <Panel eyebrow={`${formatUSD(bal)} at ${c.apr !== null ? formatPct(c.apr, 2) : '—'} APR`} title="Payoff planner" right={<LabelChip label="estimate" small />}>
            <Text style={{ color: t.c.ink, fontSize: 13 }}>Monthly payment (assuming no new charges)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: t.c.ink, fontSize: 20, fontWeight: '900' }}>$</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                accessibilityLabel="Monthly payment in dollars"
                style={{ flex: 1, borderWidth: 1.5, borderColor: t.c.line, borderRadius: t.radius.md, paddingHorizontal: 12, paddingVertical: 8, fontSize: 20, fontWeight: '800', color: t.c.ink, backgroundColor: t.c.bg }}
              />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {[50, 100, 200, 400].map((v) => (
                <Text
                  key={v}
                  accessibilityRole="button"
                  onPress={() => setAmount(String(v))}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: t.c.line, color: t.c.ink, fontWeight: '700', fontSize: 12, overflow: 'hidden' }}
                >
                  ${v}
                </Text>
              ))}
            </View>
            {plan.feasible && plan.months !== null ? (
              <>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Big label="Months to $0" value={String(plan.months)} />
                  <Big label="Total interest" value={formatUSD(plan.totalInterest)} tone={t.c.danger} />
                </View>
                <Measure height={120}>
                  {(w) => (
                    <LineChart
                      width={w}
                      height={120}
                      includeZero
                      labels={['Now', ...plan.schedule.map((m) => `Month ${m.month}`)]}
                      series={[{ key: 'bal', label: 'Balance', color: t.c.danger, values: [bal, ...plan.schedule.map((m) => m.balance)] }]}
                      format={(v) => formatUSD(v)}
                      summary={plan.sentence}
                    />
                  )}
                </Measure>
              </>
            ) : null}
            <Text style={{ color: plan.feasible ? t.c.ink : t.c.danger, fontSize: 13, lineHeight: 19 }}>{plan.sentence}</Text>
          </Panel>
        </Grid>
      ) : null}

      <Panel eyebrow="Card payments vs new charges" title="Rebound detector">
        {c.rebounds.map((r, i) => (
          <View key={r.date} style={{ gap: 4, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: t.c.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, color: t.c.ink, fontWeight: '800' }}>
                Paid {formatUSD(r.paid)} on {shortDate(r.date)}
              </Text>
              <Text style={{ color: r.outrun ? t.c.danger : t.c.primary, fontWeight: '800', fontSize: 12 }}>{r.outrun ? 'OUTRUN' : 'HELD UP'}</Text>
            </View>
            <View style={{ height: 8, backgroundColor: t.c.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ width: `${Math.min(100, r.share * 100)}%`, height: '100%', backgroundColor: r.outrun ? t.c.danger : t.c.inkSoft, borderRadius: 4 }} />
            </View>
            <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>
              {formatUSD(r.chargesAfter)} charged in the next 14 days ({pct(r.share)} of the payment)
              {r.topMerchants.length ? `: ${r.topMerchants.map((m) => `${m.name} ${formatUSD(m.amount)}`).join(', ')}` : ''}.
            </Text>
          </View>
        ))}
        {c.trend.outrun || lastRebound ? (
          <Explainer title="What “outrun” means" tone="warn">
            {`When new charges win back half or more of a payment within two weeks, the balance barely moves even though money went in.${lastRebound ? ` After ${shortDate(lastRebound.date)}, ${pct(lastRebound.share)} of the payment came back as new charges.` : ''} Companies show the same pattern when debt repaid one quarter is re-borrowed the next.`}
          </Explainer>
        ) : null}
        <LinkPill label="Lesson: debt-to-equity" href="/lesson/u5-l3" />
      </Panel>

      <CoverCard coverage={dash.coverage} />
    </View>
  );
}

function DateBox({ label, date, color }: { label: string; date: string | null; color: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', borderWidth: 1.5, borderColor: color, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 }}>
      <Text style={{ color: t.c.inkSoft, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ color: t.c.ink, fontSize: 15, fontWeight: '900' }}>{date ? shortDate(date) : '—'}</Text>
    </View>
  );
}

function Big({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.surfaceAlt, borderRadius: t.radius.md, padding: 10 }}>
      <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800' }}>{label}</Text>
      <Text style={{ color: tone ?? t.c.ink, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}
