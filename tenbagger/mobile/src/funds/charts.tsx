/** Small chart pieces for fund screens (react-native-svg + plain views). */
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '../theme';
import { neutral, seriesColors } from './palette';

export type Slice = { label: string; value: number; neutral?: boolean };

const pct = (v: number) => `${(v * 100).toFixed(v >= 0.995 || v === 0 ? 0 : 1)}%`;

/** Donut with a 2px surface gap between segments and a legend with values (never colour-only). */
export function Donut({ slices, size = 132, center, title }: { slices: Slice[]; size?: number; center?: string; title: string }) {
  const t = useTheme();
  const colors = seriesColors(t.dark);
  const shown = slices.filter((s) => s.value > 0.0005);
  const total = shown.reduce((s, x) => s + x.value, 0) || 1;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const gap = shown.length > 1 ? 2 : 0;
  let offset = 0;
  let ci = 0;
  const colored = shown.map((s) => ({ ...s, color: s.neutral ? neutral(t.dark) : colors[ci++ % colors.length] }));
  const label = `${title}: ${colored.map((s) => `${s.label} ${pct(s.value / total)}`).join(', ')}`;
  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.c.surfaceAlt} strokeWidth={stroke} fill="none" />
            {colored.map((s) => {
              const len = (s.value / total) * circ;
              const el = (
                <Circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={s.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${Math.max(0, len - gap)} ${circ}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
          </G>
        </Svg>
        {center && (
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
            <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 15 }}>{center}</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        {colored.map((s) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} />
            <Text style={{ flex: 1, color: t.c.ink, fontSize: 13 }}>{s.label}</Text>
            <Text style={{ color: t.c.ink, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{pct(s.value / total)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Labelled horizontal bar row: single hue (magnitude), value in text ink. */
export function WeightBar({
  label,
  sub,
  value,
  max,
  onPress,
  muted,
  a11yHint,
}: {
  label: string;
  sub?: string;
  value: number;
  max: number;
  onPress?: () => void;
  muted?: boolean;
  a11yHint?: string;
}) {
  const t = useTheme();
  const w = max > 0 ? Math.max(0.01, Math.min(1, value / max)) : 0;
  const body = (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, color: t.c.ink, fontSize: 14, fontWeight: '700' }}>
          {label}
          {sub ? <Text style={{ color: t.c.inkSoft, fontWeight: '600', fontSize: 12 }}>{`  ${sub}`}</Text> : null}
        </Text>
        <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] }}>{pct(value)}</Text>
        {onPress && <Text style={{ color: t.c.inkSoft, fontSize: 14 }}>›</Text>}
      </View>
      <View style={{ height: 8, backgroundColor: t.c.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ width: `${w * 100}%`, height: '100%', borderRadius: 4, backgroundColor: muted ? neutral(t.dark) : t.c.primary }} />
      </View>
    </View>
  );
  const a11y = `${label}${sub ? `, ${sub}` : ''}: ${pct(value)}${a11yHint ? `. ${a11yHint}` : ''}`;
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={a11y} style={{ paddingVertical: 4 }}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => ({ paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}
    >
      {body}
    </Pressable>
  );
}

export function SampleBadge() {
  const t = useTheme();
  return (
    <View accessibilityLabel="Sample data: approximate, not from a live filing" style={{ backgroundColor: t.c.accentSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: t.c.ink, fontSize: 11, fontWeight: '800' }}>Sample data</Text>
    </View>
  );
}
