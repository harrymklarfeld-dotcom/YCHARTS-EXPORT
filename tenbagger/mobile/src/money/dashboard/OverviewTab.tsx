/** Overview: liquidity / investments / debt, can-I-cover-the-card, net-worth history, next events, top alerts. */
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useTheme } from '../../theme';
import { LineChart } from '../charts';
import { LabelChip, Money } from '../components';
import { formatUSD, shortDate, weekday, weekdayName } from '../engine';
import { CoverCard } from '../sections';
import type { TabProps } from './types';
import { Grid, Measure, Panel, Stat } from './ui';

export default function OverviewTab({ dash, wide, goTab }: TabProps) {
  const t = useTheme();
  const b = dash.breakdown;
  const s = dash.series;
  const sevColor = { high: t.c.danger, medium: t.c.accent, info: t.c.inkSoft } as const;
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Stat label="Liquidity" value={b.liquidity.value} basis={b.liquidity.label} tone={t.c.primary} sub={b.liquidityRatio.value !== null ? `Covers short-term debt ${b.liquidityRatio.value.toFixed(2)}×` : 'Checking + savings'} />
        <Stat label="Investments" value={b.investments.value} basis={b.investments.label} tone={t.c.accent} sub="Not counted as spendable cash" />
        <Stat label="Debt" value={b.debt.value} basis={b.debt.label} tone={t.c.danger} sub={dash.card.utilization?.ratio != null ? `Card ${Math.round(dash.card.utilization.ratio * 100)}% of limit` : undefined} />
      </View>

      <Grid wide={wide} min={340}>
        <View style={{ gap: 14 }}>
          <CoverCard coverage={dash.coverage} compact />
          <Pressable accessibilityRole="link" onPress={() => goTab('credit')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -6 }}>
            <Text style={{ color: t.c.primary, fontWeight: '800', fontSize: 13 }}>See the math and the payoff planner</Text>
            <Icon name="chevron" color={t.c.primary} size={13} />
          </Pressable>
        </View>
        <Panel eyebrow={`${s.length} snapshots since ${s[0] ? shortDate(s[0].date) : '—'}`} title="Net worth over time" right={<LabelChip label={b.net.label} small />}>
          <Measure>
            {(w) => (
              <LineChart
                width={w}
                labels={s.map((p) => shortDate(p.date))}
                series={[{ key: 'net', label: 'Net worth', color: t.c.primary, values: s.map((p) => p.net) }]}
                format={(v) => formatUSD(v)}
                summary={`Net worth from ${formatUSD(s[0]?.net ?? 0)} on ${s[0] ? shortDate(s[0].date) : ''} to ${formatUSD(b.net.value)} on ${shortDate(b.asOf)}.`}
              />
            )}
          </Measure>
          <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Snapshots are only ever added, never edited, so this line is real history.</Text>
        </Panel>
      </Grid>

      <Grid wide={wide} min={340}>
        <Panel eyebrow="Coming up" title="Next 3 events">
          {dash.events.slice(0, 3).map((e, i) => (
            <View key={`${e.date}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: t.c.line }}>
              <View style={{ width: 46, alignItems: 'center' }}>
                <Text style={{ color: t.c.inkSoft, fontSize: 10, fontWeight: '800' }}>{weekdayName(weekday(e.date)).toUpperCase()}</Text>
                <Text style={{ color: t.c.ink, fontSize: 13, fontWeight: '800' }}>{shortDate(e.date)}</Text>
              </View>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: e.kind === 'due' ? t.c.danger : e.kind === 'pay' ? (e.basis === 'pending' ? t.c.accent : t.c.primary) : t.c.inkSoft }} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: t.c.ink, fontSize: 14, fontWeight: '700' }}>{e.label}</Text>
                <LabelChip label={e.basis} small />
              </View>
              <Money value={e.amount} size={15} signed color={e.amount < 0 ? t.c.danger : t.c.primary} />
            </View>
          ))}
          {dash.events.length === 0 ? <Text style={{ color: t.c.inkSoft }}>Nothing scheduled in the next {dash.coverage.runway.length - 1} days.</Text> : null}
        </Panel>
        <Panel eyebrow="Worth a look" title="Top alerts">
          {dash.alerts.slice(0, 3).map((a, i) => (
            <Pressable
              key={a.id}
              accessibilityRole="link"
              accessibilityLabel={`${a.title}. ${a.text} Opens the ${a.tab} tab.`}
              onPress={() => goTab(a.tab as never)}
              style={({ pressed }) => ({ flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: t.c.line, opacity: pressed ? 0.6 : 1 })}
            >
              <View style={{ width: 4, borderRadius: 2, backgroundColor: sevColor[a.severity] }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 14 }}>{a.title}</Text>
                <Text style={{ color: t.c.inkSoft, fontSize: 13, lineHeight: 18 }}>{a.text}</Text>
              </View>
              <Icon name="chevron" color={t.c.inkSoft} size={14} />
            </Pressable>
          ))}
          {dash.alerts.length === 0 ? <Text style={{ color: t.c.inkSoft }}>Nothing stands out right now.</Text> : null}
        </Panel>
      </Grid>
    </View>
  );
}
