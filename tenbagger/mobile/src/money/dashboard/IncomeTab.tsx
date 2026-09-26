/**
 * Income: streams (hourly, per-session, detected), a one-tap "work not yet cashed" logger
 * (local only), reminders for unsubmitted hours, pay history, volatility and annualized income.
 * Logging work never awards XP.
 */
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useTheme } from '../../theme';
import { BarChart } from '../charts';
import { LabelChip, Money } from '../components';
import { formatUSD, shortDate } from '../engine';
import { describeStream } from '../hub';
import { useMoneyStore } from '../store';
import { Streams } from '../sections';
import type { TabProps } from './types';
import { Explainer, Grid, KV, LinkPill, Measure, Panel } from './ui';

export default function IncomeTab({ dash, hub, local, wide }: TabProps) {
  const t = useTheme();
  const logWork = useMoneyStore((s) => s.logWork);
  const removeWork = useMoneyStore((s) => s.removeWork);
  const markSubmitted = useMoneyStore((s) => s.markSubmitted);
  const today = dash.asOf;
  const vol = dash.income.volatility;
  const deps = [...hub.data.deposits].filter((d) => d.basis === 'verified' || d.basis === 'manual').sort((a, b) => (a.date < b.date ? -1 : 1));
  const streamName = (id?: string) => hub.data.streams.find((s) => s.id === id)?.name ?? 'Other';
  const detected = hub.data.detectedStreams ?? [];
  const unsubmitted = local.workLog.filter((e) => !e.submitted);

  return (
    <View style={{ gap: 14 }}>
      <Panel eyebrow="Work not yet cashed" title="Log work in one tap">
        <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>Payroll can only see a paycheck after it lands. Logging hours here shows the money they will bring, and reminds you to submit them.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {hub.data.streams
            .filter((s) => s.kind === 'hourly' || s.kind === 'per_session')
            .map((s) => {
              const units = s.kind === 'hourly' ? 5 : 1;
              const label = s.kind === 'hourly' ? `Log ${units} hours today` : 'Log a session today';
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${label} for ${s.name}`}
                  onPress={() => logWork(s.id, units, today)}
                  style={({ pressed }) => ({
                    flexGrow: 1,
                    flexBasis: 200,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    padding: 14,
                    borderRadius: t.radius.md,
                    backgroundColor: pressed ? t.c.primarySoft : t.c.surfaceAlt,
                    borderWidth: 1.5,
                    borderColor: t.c.primary,
                  })}
                >
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.c.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="plus" color={t.c.primaryInk} size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.c.ink, fontWeight: '900', fontSize: 15 }}>{label}</Text>
                    <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>
                      {s.name} · +{formatUSD(units * s.rate * (1 - s.withholdingRate), { cents: true })} after withholding
                    </Text>
                  </View>
                </Pressable>
              );
            })}
        </View>
        {unsubmitted.length ? (
          <View style={{ gap: 2 }}>
            <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Logged, not submitted</Text>
            {unsubmitted.map((e) => (
              <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                <Text style={{ flex: 1, color: t.c.ink, fontSize: 13 }}>
                  {shortDate(e.date)} · {streamName(e.streamId)} · {e.units} {hub.data.streams.find((s) => s.id === e.streamId)?.kind === 'per_session' ? 'session' : 'hours'}
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Remove this entry" onPress={() => removeWork(e.id)} hitSlop={10}>
                  <Icon name="trash" color={t.c.inkSoft} size={16} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </Panel>

      {dash.pending.length ? (
        <Panel eyebrow="Reminders" title="Unsubmitted work" right={<LabelChip label="pending" small />}>
          {dash.pending.map((p) => (
            <View key={p.streamId} style={{ gap: 6, paddingVertical: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={{ flex: 1, color: t.c.ink, fontWeight: '800', fontSize: 15 }}>{p.streamName}</Text>
                <Money value={p.net} size={18} color={t.c.accent} />
              </View>
              <Text style={{ color: t.c.ink, fontSize: 13, lineHeight: 19 }}>{p.reminder}</Text>
              <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>
                {p.carriedUnits ? `${p.carriedUnits} ${p.unitWord} from the last pay period` : ''}
                {p.carriedUnits && p.loggedUnits ? ' + ' : ''}
                {p.loggedUnits ? `${p.loggedUnits} logged in the app` : ''}
              </Text>
              {p.loggedUnits ? <LinkPill label="I submitted the logged ones" icon="check" onPress={() => markSubmitted(p.streamId)} /> : null}
            </View>
          ))}
          <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Hours from the period already closed count as PENDING in the card check; new hours belong to the current period, which the schedule already projects.</Text>
        </Panel>
      ) : null}

      <Grid wide={wide} min={320}>
        <Panel eyebrow={`${deps.length} deposits since ${deps[0] ? shortDate(deps[0].date) : '—'}`} title="Pay history" right={<LabelChip label="verified" small />}>
          <Measure height={150}>
            {(w) => (
              <BarChart
                width={w}
                bars={deps.map((d, i) => ({ key: `${d.date}-${i}`, label: shortDate(d.date), value: d.amount, color: d.streamId === 'campus-job' ? t.c.primary : d.streamId === 'tutoring' ? t.c.accent : t.c.inkSoft }))}
                format={(v) => formatUSD(v, { cents: true })}
                summary={`${deps.length} deposits from ${formatUSD(Math.min(...deps.map((d) => d.amount)))} to ${formatUSD(Math.max(...deps.map((d) => d.amount)))}.`}
              />
            )}
          </Measure>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            {[...new Set(deps.map((d) => d.streamId))].map((id) => (
              <View key={id ?? 'other'} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: id === 'campus-job' ? t.c.primary : id === 'tutoring' ? t.c.accent : t.c.inkSoft }} />
                <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{streamName(id)}</Text>
              </View>
            ))}
          </View>
        </Panel>

        <Panel eyebrow="How steady is it?" title="Income volatility">
          {vol.months.map((m) => (
            <KV key={m.month} label={m.month} value={formatUSD(m.total)} basis={vol.label} />
          ))}
          <KV label="Variation (stdev ÷ average)" value={vol.cv === null ? '—' : vol.cv.toFixed(2)} strong />
          <Explainer title="In plain English">
            {vol.cv === null
              ? 'Two complete months of deposits are needed before the swing can be measured.'
              : `A month is typically about ${Math.round(vol.cv * 100)}% above or below the ${formatUSD(vol.mean ?? 0)} average. Hourly work swings with shifts, exams and paperwork, so a plan built on the average needs a cushion for the low months.`}
          </Explainer>
          <KV label="Annualized (last 90 days × 365/90)" value={formatUSD(dash.income.annualized.value)} basis="estimate" strong />
          <LinkPill label="Learn: income volatility" href="/money/learn/income-volatility" />
        </Panel>
      </Grid>

      <Streams hub={hub} />

      {detected.length ? (
        <Panel eyebrow="Seen in your bank history" title="Detected income">
          {detected.map((d) => (
            <View key={d.id} style={{ gap: 3, paddingVertical: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 14, flexShrink: 1 }}>{d.name}</Text>
                <LabelChip label="verified" small />
                <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800' }}>{d.status === 'MATURE' ? 'REGULAR' : 'EARLY PATTERN'}</Text>
              </View>
              <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>
                {d.frequency.toLowerCase()} · average {d.averageAmount !== null ? formatUSD(d.averageAmount, { cents: true }) : '—'} · last {d.lastDate ? shortDate(d.lastDate) : '—'}
                {d.predictedNextDate ? ` · next expected ${shortDate(d.predictedNextDate)}` : ''}
              </Text>
              {d.matchesStreamId ? (
                <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>
                  Matches “{streamName(d.matchesStreamId)}” ({describeStream(hub.data.streams.find((s) => s.id === d.matchesStreamId)!)}), so it is counted once.
                </Text>
              ) : null}
            </View>
          ))}
        </Panel>
      ) : null}
    </View>
  );
}
