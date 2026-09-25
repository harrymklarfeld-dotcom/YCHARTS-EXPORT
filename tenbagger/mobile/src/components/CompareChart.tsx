import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import {
  domainOf,
  formatCompare,
  lastPoint,
  niceTicks,
  spreadLabels,
  valueAt,
  yearsOf,
  type CompareMode,
  type CompareSeries,
} from '../funds/compare';
import { DASHES, seriesColors } from '../funds/palette';
import { useTheme } from '../theme';

type Props = {
  series: CompareSeries[];
  mode: CompareMode;
  kind: 'usd' | 'per_share' | 'ratio';
  title: string;
  width: number;
  height?: number;
};

const PAD = { l: 46, r: 70, t: 14, b: 26 };

/**
 * Multi-line chart for up to 3 companies. One y-axis, recessive grid, 2px lines with
 * distinct dash patterns, direct end labels + legend (identity never colour-only),
 * tap anywhere on the plot (or use ◀ ▶) to inspect a year.
 */
export function CompareChart({ series, mode, kind, title, width, height = 240 }: Props) {
  const t = useTheme();
  const colors = seriesColors(t.dark);
  const years = useMemo(() => yearsOf(series), [series]);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => setSel(null), [series]);
  const selYear = sel !== null && years.includes(sel) ? sel : years[years.length - 1] ?? null;

  const plotW = Math.max(40, width - PAD.l - PAD.r);
  const plotH = height - PAD.t - PAD.b;
  const dom = domainOf(series, mode);
  const ticks = niceTicks(dom.min, dom.max, 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const x = (fy: number) => PAD.l + (years.length <= 1 ? plotW / 2 : ((fy - years[0]) / (years[years.length - 1] - years[0])) * plotW);
  const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;
  const fmt = (v: number | null) => formatCompare(v, mode, kind);
  const fmtTick = (v: number) => (mode === 'indexed' ? v.toFixed(0) : formatCompare(v, mode, kind).replace(/\.0(?=[%BTM])/, ''));

  const paths = series.map((s) => {
    let d = '';
    let pen = false;
    for (const p of s.points) {
      if (p.value === null) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${x(p.fy).toFixed(1)},${y(p.value).toFixed(1)} `;
      pen = true;
    }
    return d.trim();
  });

  const ends = series.map((s) => lastPoint(s));
  const endYs = spreadLabels(ends.map((e) => (e ? y(e.value as number) : PAD.t)), 26, PAD.t + 6, PAD.t + plotH);

  const onPlotPress = (e: GestureResponderEvent) => {
    if (!years.length) return;
    const lx = e.nativeEvent.locationX;
    let best = years[0];
    for (const fy of years) if (Math.abs(x(fy) - PAD.l - lx) < Math.abs(x(best) - PAD.l - lx)) best = fy;
    setSel(best);
  };
  const step = (d: -1 | 1) => {
    if (selYear === null) return;
    const i = years.indexOf(selYear) + d;
    if (i >= 0 && i < years.length) setSel(years[i]);
  };

  const summary = series.length
    ? `${title}. ${series
        .map((s) => {
          const first = s.points.find((p) => p.value !== null);
          const last = lastPoint(s);
          return first && last ? `${s.ticker} from ${fmt(first.value)} in FY${first.fy} to ${fmt(last.value)} in FY${last.fy}` : `${s.ticker}: no data`;
        })
        .join('; ')}.`
    : `${title}: pick a company to start.`;

  if (!series.length || !years.length) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: t.c.inkSoft }}>Pick up to 3 companies to compare.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {/* legend */}
      <View accessibilityRole="text" accessibilityLabel={`Legend: ${series.map((s) => s.ticker).join(', ')}`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {series.map((s, i) => (
          <View key={s.ticker} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Svg width={22} height={8}>
              <Line x1={1} x2={21} y1={4} y2={4} stroke={colors[i]} strokeWidth={2.5} strokeDasharray={DASHES[i]} strokeLinecap="round" />
            </Svg>
            <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 13 }}>{s.ticker}</Text>
          </View>
        ))}
      </View>

      <View accessible accessibilityLabel={summary} style={{ width, height }}>
        <Svg width={width} height={height}>
          {ticks.map((v) => (
            <Line key={`g${v}`} x1={PAD.l} x2={PAD.l + plotW} y1={y(v)} y2={y(v)} stroke={t.c.line} strokeWidth={v === 0 ? 1.5 : 1} />
          ))}
          {mode === 'indexed' && yMin < 100 && yMax > 100 && (
            <Line x1={PAD.l} x2={PAD.l + plotW} y1={y(100)} y2={y(100)} stroke={t.c.inkSoft} strokeWidth={1} strokeDasharray="3 4" />
          )}
          {ticks.map((v) => (
            <SvgText key={`t${v}`} x={PAD.l - 6} y={y(v) + 3.5} fontSize={10} fill={t.c.inkSoft} textAnchor="end">
              {fmtTick(v)}
            </SvgText>
          ))}
          {[years[0], years[years.length - 1]].filter((v, i, a) => a.indexOf(v) === i).map((fy) => (
            <SvgText key={`x${fy}`} x={x(fy)} y={height - 8} fontSize={10} fill={t.c.inkSoft} textAnchor="middle">
              {`FY${fy}`}
            </SvgText>
          ))}
          {selYear !== null && (
            <Line x1={x(selYear)} x2={x(selYear)} y1={PAD.t} y2={PAD.t + plotH} stroke={t.c.inkSoft} strokeWidth={1} />
          )}
          {selYear !== null && selYear !== years[0] && selYear !== years[years.length - 1] && (
            <SvgText x={x(selYear)} y={height - 8} fontSize={10} fontWeight="700" fill={t.c.ink} textAnchor="middle">
              {`FY${selYear}`}
            </SvgText>
          )}
          {paths.map((d, i) =>
            d ? <Path key={series[i].ticker} d={d} stroke={colors[i]} strokeWidth={2} fill="none" strokeDasharray={DASHES[i]} strokeLinejoin="round" strokeLinecap="round" /> : null,
          )}
          {series.map((s, i) => {
            const v = selYear !== null ? valueAt(s, selYear) : null;
            return v === null ? null : (
              <Circle key={`d${s.ticker}`} cx={x(selYear!)} cy={y(v)} r={4.5} fill={colors[i]} stroke={t.c.surface} strokeWidth={2} />
            );
          })}
          {series.map((s, i) => {
            const e = ends[i];
            if (!e) return null;
            return (
              <SvgText key={`e${s.ticker}`} x={PAD.l + plotW + 8} y={endYs[i]} fontSize={11} fontWeight="800" fill={t.c.ink}>
                {s.ticker}
              </SvgText>
            );
          })}
          {series.map((s, i) => {
            const e = ends[i];
            if (!e) return null;
            return (
              <SvgText key={`v${s.ticker}`} x={PAD.l + plotW + 8} y={endYs[i] + 12} fontSize={10} fill={t.c.inkSoft}>
                {fmt(e.value)}
              </SvgText>
            );
          })}
          {series.map((s, i) => {
            const e = ends[i];
            return e ? <Circle key={`end${s.ticker}`} cx={x(e.fy)} cy={y(e.value as number)} r={3} fill={colors[i]} /> : null;
          })}
        </Svg>
        <Pressable
          accessibilityLabel="Tap the chart to inspect a year"
          onPress={onPlotPress}
          style={{ position: 'absolute', left: PAD.l, top: 0, width: plotW, height }}
        />
      </View>

      {/* inspect readout */}
      {selYear !== null && (
        <View style={{ backgroundColor: t.c.surfaceAlt, borderRadius: t.radius.md, padding: 10, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous year" onPress={() => step(-1)} hitSlop={10} style={{ padding: 4 }}>
              <Text style={{ color: t.c.ink, fontSize: 16, fontWeight: '800' }}>‹</Text>
            </Pressable>
            <Text accessibilityLiveRegion="polite" style={{ color: t.c.ink, fontWeight: '800', fontSize: 13 }}>FY{selYear}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Next year" onPress={() => step(1)} hitSlop={10} style={{ padding: 4 }}>
              <Text style={{ color: t.c.ink, fontSize: 16, fontWeight: '800' }}>›</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {series.map((s, i) => (
              <View key={s.ticker} accessible accessibilityLabel={`${s.ticker} FY${selYear}: ${fmt(valueAt(s, selYear))}`} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[i] }} />
                <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '700' }}>{s.ticker}</Text>
                <Text style={{ color: t.c.ink, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{fmt(valueAt(s, selYear))}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
