import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme';

export function GoalRing({ earned, goal, size = 64 }: { earned: number; goal: number; size?: number }) {
  const t = useTheme();
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const frac = Math.min(1, earned / Math.max(1, goal));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Daily goal: ${earned} of ${goal} XP`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.c.surfaceAlt} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={frac >= 1 ? t.c.primary : t.c.accent}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - frac)}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={{ fontSize: 14, fontWeight: '800', color: t.c.ink, fontVariant: ['tabular-nums'] }}>{earned}</Text>
      <Text style={{ fontSize: 9, fontWeight: '700', color: t.c.inkSoft }}>/ {goal} XP</Text>
    </View>
  );
}
