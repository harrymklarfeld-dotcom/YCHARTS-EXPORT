import { Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import type { HistoryPoint } from '../types/contract';
import { useTheme } from '../theme';

type Props = { data: HistoryPoint[]; format: (v: number | null) => string; title: string; width?: number; height?: number };

/** Small annual bar chart: positive bars in primary, negatives below a zero line in danger. */
export function MiniBarChart({ data, format, title, width = 150, height = 64 }: Props) {
  const t = useTheme();
  const vals = data.map(([, v]) => v ?? 0);
  const max = Math.max(0, ...vals);
  const min = Math.min(0, ...vals);
  const span = max - min || 1;
  const zeroY = (max / span) * height;
  const gap = 3;
  const bw = Math.max(3, (width - gap * (data.length - 1)) / Math.max(1, data.length));
  const last = data[data.length - 1];
  const first = data[0];
  const summary = data.length
    ? `${title}: FY${first[0]} ${format(first[1])} to FY${last[0]} ${format(last[1])}`
    : `${title}: no data`;
  return (
    <View accessible accessibilityLabel={summary} style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: t.c.ink, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{last ? format(last[1]) : '—'}</Text>
      </View>
      <Svg width={width} height={height}>
        {data.map(([fy, v], i) => {
          const val = v ?? 0;
          const h = (Math.abs(val) / span) * height;
          const y = val >= 0 ? zeroY - h : zeroY;
          const isLast = i === data.length - 1;
          return (
            <Rect
              key={fy}
              x={i * (bw + gap)}
              y={y}
              width={bw}
              height={Math.max(1, h)}
              rx={2}
              fill={val < 0 ? t.c.danger : isLast ? t.c.primary : t.c.primarySoft}
              opacity={v === null ? 0.25 : 1}
            />
          );
        })}
        {min < 0 && <Line x1={0} x2={width} y1={zeroY} y2={zeroY} stroke={t.c.inkSoft} strokeWidth={1} strokeDasharray="2 3" />}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: t.c.inkSoft, fontSize: 10 }}>{first ? `FY${first[0]}` : ''}</Text>
        <Text style={{ color: t.c.inkSoft, fontSize: 10 }}>{last ? `FY${last[0]}` : ''}</Text>
      </View>
    </View>
  );
}
