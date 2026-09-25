import { Text, View } from 'react-native';
import type { FunnelOutput } from '../../lib/screener';
import { useTheme } from '../../theme';

/**
 * A compact funnel: one bar per stage (start, then after each filter), width ∝ companies left.
 * The stage after the filter that removed the most is highlighted.
 */
export function FunnelBar({ funnel, extra }: { funnel: FunnelOutput; extra?: { label: string; after: number } }) {
  const t = useTheme();
  const stages = [
    { label: 'All companies', after: funnel.start, cut: false },
    ...funnel.steps.map((s) => ({ label: s.label, after: s.after, cut: funnel.biggestCut?.index === s.index })),
    ...(extra ? [{ label: extra.label, after: extra.after, cut: false }] : []),
  ];
  const max = Math.max(1, funnel.start);
  const big = funnel.biggestCut;
  return (
    <View
      accessible
      accessibilityLabel={`Filter funnel: ${stages.map((s) => `${s.label}, ${s.after} left`).join('; ')}.`}
      style={{ gap: 6 }}
    >
      {stages.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, height: 18, justifyContent: 'center' }}>
            <View
              style={{
                height: 18,
                width: `${Math.max(2, (s.after / max) * 100)}%`,
                alignSelf: 'center',
                borderRadius: 5,
                backgroundColor: s.cut ? t.c.accent : i === 0 ? t.c.line : t.c.primary,
                opacity: i === 0 ? 1 : 0.35 + 0.65 * ((i + 1) / stages.length),
              }}
            />
          </View>
          <Text numberOfLines={1} style={{ width: 150, color: t.c.inkSoft, fontSize: 12 }}>
            <Text style={{ color: t.c.ink, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{s.after}</Text> · {s.label}
          </Text>
        </View>
      ))}
      {big ? (
        <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>
          Biggest cut: <Text style={{ color: t.c.ink, fontWeight: '800' }}>{big.label}</Text> removed {big.removed}
          {big.removedForMissingData ? ` (${big.removedForMissingData} had no data)` : ''}.
        </Text>
      ) : null}
    </View>
  );
}
