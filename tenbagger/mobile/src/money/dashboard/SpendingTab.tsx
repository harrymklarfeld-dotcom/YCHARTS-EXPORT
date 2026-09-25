/**
 * Spending: categories this month vs the month before, recurring charges, fast-growing "leaks",
 * spending pace vs income, and editable categories (saved on this device).
 * Descriptive only: it never says what to cut or cancel.
 */
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { PairBar } from '../charts';
import { LabelChip } from '../components';
import { categoryTitle, DEFAULT_CATEGORY_RULES, formatUSD, merchantKey, prevMonth, shortDate } from '../engine';
import { useMoneyStore } from '../store';
import type { TabProps } from './types';
import { Explainer, Grid, KV, Panel, pct } from './ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const SPEND_CHOICES = Object.keys(DEFAULT_CATEGORY_RULES).filter((c) => !['card_payment', 'transfer', 'income'].includes(c)).concat('other');

export default function SpendingTab({ dash, local, wide }: TabProps) {
  const t = useTheme();
  const setOverride = useMoneyStore((s) => s.setCategoryOverride);
  const [editing, setEditing] = useState<string | null>(null);
  const cmp = dash.compare.filter((c) => c.current > 0 || c.prior > 0);
  const max = Math.max(1, ...cmp.flatMap((c) => [c.current, c.prior]));
  const pace = dash.pace;
  const subsMonthly = dash.subscriptions.reduce((s, x) => s + x.monthlyCost, 0);
  const merchants = useMemo(() => {
    const m = new Map<string, { name: string; category: string; total: number; count: number }>();
    for (const x of dash.tx) {
      if (x.amount >= 0 || ['card_payment', 'transfer', 'income'].includes(x.category)) continue;
      const k = merchantKey(x.name);
      const cur = m.get(k) ?? { name: x.name, category: x.category, total: 0, count: 0 };
      cur.total -= x.amount;
      cur.count += 1;
      m.set(k, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10);
  }, [dash.tx]);

  return (
    <View style={{ gap: 14 }}>
      <Panel eyebrow={`${monthName(pace.month)} so far · day ${pace.daysElapsed} of ${pace.daysInMonth}`} title="Spending pace vs income" right={<LabelChip label="estimate" small />}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Mini label="Spent so far" value={formatUSD(pace.spentSoFar)} />
          <Mini label="On pace for" value={formatUSD(pace.projectedSpend)} tone={pace.paceRatio !== null && pace.paceRatio > 1 ? t.c.danger : undefined} />
          <Mini label="Income this month" value={formatUSD(pace.expectedIncome)} sub={`${formatUSD(pace.incomeSoFar)} landed + ${formatUSD(dash.income.projectedRestOfMonth)} projected`} />
        </View>
        <View style={{ height: 12, backgroundColor: t.c.surfaceAlt, borderRadius: 6, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(100, (pace.paceRatio ?? 0) * 100)}%`, height: '100%', backgroundColor: pace.paceRatio !== null && pace.paceRatio > 1 ? t.c.danger : t.c.primary, borderRadius: 6 }} />
        </View>
        <Text style={{ color: t.c.ink, fontSize: 13, lineHeight: 19 }}>{pace.sentence}</Text>
        <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Early in a month the pace is jumpy: one grocery run moves it a lot.</Text>
      </Panel>

      <Grid wide={wide} min={320}>
        <Panel eyebrow={`${monthName(dash.spendMonth)} vs ${monthName(prevMonth(dash.spendMonth))}`} title="Categories" right={<LabelChip label={dash.spend.label} small />}>
          <KV label={`Total spent in ${monthName(dash.spendMonth)}`} value={formatUSD(dash.spend.total)} strong />
          {cmp.map((c) => (
            <View key={c.category} style={{ gap: 4, paddingVertical: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={{ flex: 1, color: t.c.ink, fontSize: 14, fontWeight: '700' }}>{c.title}</Text>
                <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 14, fontVariant: ['tabular-nums'] }}>{formatUSD(c.current)}</Text>
                <Text style={{ width: 64, textAlign: 'right', color: c.change > 0 ? t.c.danger : t.c.primary, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                  {c.change === 0 ? '—' : formatUSD(c.change, { signed: true })}
                </Text>
              </View>
              <PairBar current={c.current} prior={c.prior} max={max} color={t.c.primary} />
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <Legend color={t.c.primary} text={monthName(dash.spendMonth)} />
            <Legend color={t.c.inkSoft} text={monthName(prevMonth(dash.spendMonth))} thin />
          </View>
        </Panel>

        <View style={{ gap: 14 }}>
          <Panel eyebrow="Growing fastest" title="Leaks">
            {dash.leaks.length ? (
              dash.leaks.map((l) => (
                <View key={l.category} style={{ flexDirection: 'row', gap: 8, paddingVertical: 3 }}>
                  <View style={{ width: 4, borderRadius: 2, backgroundColor: t.c.accent }} />
                  <Text style={{ flex: 1, color: t.c.ink, fontSize: 13, lineHeight: 19 }}>{l.sentence}</Text>
                </View>
              ))
            ) : (
              <Text style={{ color: t.c.inkSoft }}>No category grew more than 25% and $20.</Text>
            )}
            <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>A leak is a category up at least 25% and $20 on the month before. Some are one-offs (textbooks at the start of term).</Text>
          </Panel>

          <Panel eyebrow={`About ${formatUSD(subsMonthly, { cents: true })} a month`} title="Recurring charges" right={<LabelChip label="verified" small />}>
            {dash.subscriptions.map((s) => (
              <View key={s.merchant} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.c.ink, fontWeight: '700', fontSize: 14 }}>{s.name}</Text>
                  <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>
                    {categoryTitle(s.category)} · every ~{s.cadenceDays} days · {s.occurrences}× · next ~{shortDate(s.nextExpected)}
                  </Text>
                </View>
                <Text style={{ color: t.c.ink, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{formatUSD(s.lastAmount, { cents: true })}</Text>
              </View>
            ))}
            <Explainer title="How these are found">
              {`Same merchant, about a month apart, similar amount (within 15%), at least three times. Together about ${formatUSD(subsMonthly * 12)} a year.`}
            </Explainer>
          </Panel>
        </View>
      </Grid>

      <Panel eyebrow="Rule-based, and yours to edit" title="Top merchants & categories">
        <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Tap a merchant to change its category. Changes stay on this device and update every total.</Text>
        {merchants.map(([k, m]) => (
          <View key={k} style={{ gap: 6, paddingVertical: 4, borderTopWidth: 1, borderTopColor: t.c.line }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${m.name}, ${categoryTitle(m.category)}. Change category`} onPress={() => setEditing(editing === k ? null : k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 }}>
              <Text style={{ flex: 1, color: t.c.ink, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                {m.name}
              </Text>
              <Text style={{ color: local.categoryOverrides[k] ? t.c.accent : t.c.inkSoft, fontSize: 12, fontWeight: '700' }}>
                {categoryTitle(m.category)}
                {local.categoryOverrides[k] ? ' (edited)' : ''}
              </Text>
              <Text style={{ width: 70, textAlign: 'right', color: t.c.ink, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{formatUSD(m.total)}</Text>
            </Pressable>
            {editing === k ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {SPEND_CHOICES.map((c) => (
                  <Pressable
                    key={c}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: c === m.category }}
                    onPress={() => {
                      setOverride(k, c);
                      setEditing(null);
                    }}
                    style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: c === m.category ? t.c.ink : t.c.line, backgroundColor: c === m.category ? t.c.ink : t.c.surface }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: c === m.category ? t.c.bg : t.c.ink }}>{categoryTitle(c)}</Text>
                  </Pressable>
                ))}
                {local.categoryOverrides[k] ? (
                  <Pressable accessibilityRole="button" onPress={() => setOverride(k, null)} style={{ paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: t.c.primary }}>Reset to rule</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ))}
        <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Share of spending in {monthName(dash.spendMonth)}: {dash.spend.categories.slice(0, 3).map((c) => `${c.title} ${pct(c.share)}`).join(' · ')}</Text>
      </Panel>
    </View>
  );
}

function Mini({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: 120, backgroundColor: t.c.surfaceAlt, borderRadius: t.radius.md, padding: 10, gap: 2 }}>
      <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800' }}>{label}</Text>
      <Text style={{ color: tone ?? t.c.ink, fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{value}</Text>
      {sub ? <Text style={{ color: t.c.inkSoft, fontSize: 11 }}>{sub}</Text> : null}
    </View>
  );
}

function Legend({ color, text, thin }: { color: string; text: string; thin?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 14, height: thin ? 4 : 8, borderRadius: 2, backgroundColor: color, opacity: thin ? 0.6 : 1 }} />
      <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{text}</Text>
    </View>
  );
}
