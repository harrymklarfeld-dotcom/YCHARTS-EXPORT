import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { getCompany } from '../../data';
import { useTheme } from '../../theme';
import type { HistoryKey } from '../../types/contract';
import { seriesMean } from '../calc';
import { getArticlesFile } from '../data';
import { provenanceTags } from '../provenance';
import { formatMetric } from '../values';
import { Unsupported, WidgetFrame } from './WidgetFrame';

const H = 150;
const AXIS = 18;

/** Annual bars from `history`, negatives below zero in red; tap a bar to read its value. */
export function HistoryWidget({ ticker, metric, average, caption }: { ticker: string; metric: HistoryKey; average: boolean; caption?: string }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const catalog = getArticlesFile().metrics;
  const c = getCompany(ticker);
  const series = (c?.history?.[metric] ?? []).filter(([, v]) => v !== null) as [number, number][];
  const [sel, setSel] = useState<number | null>(null);
  if (!c || series.length < 2) return <Unsupported reason={`no ${metric} history for ${ticker}`} />;
  const label = catalog[metric]?.label ?? metric;
  const vals = series.map(([, v]) => v);
  const avg = average ? seriesMean(series) : null;
  const max = Math.max(0, ...vals, avg ?? 0);
  const min = Math.min(0, ...vals, avg ?? 0);
  const span = max - min || 1;
  const plotH = H - AXIS;
  const y = (v: number) => ((max - v) / span) * plotH;
  const gap = 4;
  const bw = w > 0 ? Math.max(4, (w - gap * (series.length - 1)) / series.length) : 0;
  const idx = sel ?? series.length - 1;
  const [selFy, selV] = series[idx];
  const tags = provenanceTags([c], [metric]);
  const fmt = (v: number | null) => formatMetric(v, metric, catalog);
  return (
    <WidgetFrame
      eyebrow="History"
      title={`${c.name.replace(/,? Inc\.?$|,? Corporation$/, '')}: ${label}`}
      caption={caption}
      sample={tags.sample}
      real={`${c.ticker} reported`}
      accessibilityLabel={`${label} for ${c.ticker}, fiscal ${series[0][0]} to ${series[series.length - 1][0]}: ${series.map(([fy, v]) => `${fy} ${fmt(v)}`).join(', ')}${avg !== null ? `. Average ${fmt(avg)}` : ''}`}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: t.c.inkSoft, fontSize: 13, fontWeight: '700' }}>FY{selFy}</Text>
        <Text style={{ color: selV < 0 ? t.c.danger : t.c.ink, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'], fontFamily: t.fonts.display }}>{fmt(selV)}</Text>
      </View>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
        {w > 0 && (
          <Svg width={w} height={H} style={{ position: 'absolute', pointerEvents: 'none' } as object}>
            {series.map(([fy, v], i) => {
              const top = v >= 0 ? y(v) : y(0);
              const h = Math.max(1.5, Math.abs(y(v) - y(0)));
              const x = i * (bw + gap);
              const on = i === idx;
              return (
                <Rect
                  key={fy}
                  x={x}
                  y={top}
                  width={bw}
                  height={h}
                  rx={3}
                  fill={v < 0 ? t.c.danger : on ? t.c.primary : t.c.primarySoft}
                  opacity={v < 0 && !on ? 0.6 : 1}
                />
              );
            })}
            {min < 0 && <Line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke={t.c.inkSoft} strokeWidth={1} />}
            {avg !== null && <Line x1={0} x2={w} y1={y(avg)} y2={y(avg)} stroke={t.c.accent} strokeWidth={2} strokeDasharray="6 4" />}
            {series.map(([fy], i) =>
              series.length <= 6 || i % 2 === (series.length - 1) % 2 ? (
                <SvgText key={fy} x={i * (bw + gap) + bw / 2} y={H - 4} fontSize={10} fill={t.c.inkSoft} textAnchor="middle">
                  {`'${String(fy).slice(2)}`}
                </SvgText>
              ) : null,
            )}
          </Svg>
        )}
        <View style={{ flexDirection: 'row', height: plotH, gap }}>
          {series.map(([fy, v], i) => (
            <Pressable
              key={fy}
              accessibilityRole="button"
              accessibilityLabel={`Fiscal ${fy}: ${fmt(v)}`}
              onPress={() => setSel(i)}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      </View>
      {avg !== null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 18, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: t.c.accent }} />
          <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>
            {series.length}-year average: <Text style={{ color: t.c.ink, fontWeight: '800' }}>{fmt(avg)}</Text>
          </Text>
        </View>
      )}
      <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Tap a bar to see that year.</Text>
    </WidgetFrame>
  );
}
