/** Shared dashboard header: net worth, change since the last snapshot, data freshness, sample banner. */
import { Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Eyebrow } from '../../components/ui';
import { useTheme } from '../../theme';
import { LabelChip, Money } from '../components';
import type { Dashboard } from '../dashboard';
import { formatUSD, shortDate } from '../engine';
import type { MoneyHub } from '../hub';

function timeOf(takenAt: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(takenAt);
  if (!m) return '';
  const h = Number(m[1]);
  return ` ${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

export function DashboardHeader({ dash, hub, compact }: { dash: Dashboard; hub: MoneyHub; compact?: boolean }) {
  const t = useTheme();
  const b = dash.breakdown;
  const ch = dash.change;
  const p = hub.data.persona;
  const fresh = dash.freshness;
  const freshText =
    `Last snapshot ${shortDate(fresh.takenAt.slice(0, 10))}${timeOf(fresh.takenAt)}` +
    (fresh.daysOld === 0 ? ' · up to date' : ` · ${fresh.daysOld} day${fresh.daysOld === 1 ? '' : 's'} old`) +
    (fresh.oldestAccount && fresh.oldestAccount.asOf < fresh.takenAt.slice(0, 10) ? ` · ${fresh.oldestAccount.name} as of ${shortDate(fresh.oldestAccount.asOf)}` : '');
  return (
    <View style={{ gap: 10 }}>
      {hub.data.sample ? (
        <View
          accessibilityRole="text"
          accessibilityLabel={`${hub.data.sampleLabel}. Showing ${p.name}, a fictional ${p.age}-year-old ${p.year}.`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.c.accentSoft, borderRadius: t.radius.md, paddingVertical: 8, paddingHorizontal: 12 }}
        >
          <Icon name="link" color={t.c.accent} size={18} />
          <Text style={{ flex: 1, color: t.c.ink, fontSize: 12 }}>
            <Text style={{ fontWeight: '800' }}>{hub.data.sampleLabel}.</Text> Showing {p.name}, {p.age}, a fictional {p.year}. Every number is made up.
          </Text>
        </View>
      ) : null}
      <View style={{ backgroundColor: t.c.ink, borderRadius: t.radius.lg, padding: compact ? 14 : 16, gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Eyebrow color={t.c.accent}>Net worth</Eyebrow>
          <LabelChip label={b.net.label} small />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <Money value={b.net.value} size={compact ? 28 : 34} weight="900" color={t.c.bg} />
          {ch ? (
            <Text accessibilityLabel={`${ch.change >= 0 ? 'Up' : 'Down'} ${formatUSD(Math.abs(ch.change))} since ${shortDate(ch.from.date)}`} style={{ color: ch.change >= 0 ? (t.dark ? '#0B6B4B' : '#8FE3BF') : t.dark ? '#9E1F17' : '#FFB4AE', fontWeight: '800', fontSize: 14, fontVariant: ['tabular-nums'] }}>
              {formatUSD(ch.change, { signed: true })} since {shortDate(ch.from.date)}
            </Text>
          ) : null}
        </View>
        <Text style={{ color: t.c.bg, opacity: 0.8, fontSize: 12 }}>
          {formatUSD(b.liquidity.value)} cash + {formatUSD(b.investments.value)} invested − {formatUSD(b.debt.value)} owed
        </Text>
        <Text style={{ color: t.c.bg, opacity: 0.65, fontSize: 11 }}>{freshText}</Text>
      </View>
    </View>
  );
}
