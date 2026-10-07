/**
 * Small SVG charts for the Money dashboard: line (with tap/drag scrub), donut, bars, progress ring.
 * Marks are thin (2px lines, rounded bar ends), text uses ink tokens (never the series color),
 * and every chart has an accessibility summary. The categorical palette below was checked with
 * the dataviz validator (lightness band, chroma, CVD and normal-vision separation, contrast)
 * against the light (#FFFFFF) and dark (#151E30) card surfaces.
 */
import { useState, type ReactNode } from 'react';
import { Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme';

export const CATEGORICAL_LIGHT = ['#0B7A57', '#8A4FA0', '#A8690F', '#2F5DA8', '#C2415F'];
export const CATEGORICAL_DARK = ['#23A876', '#A776C4', '#BF8526', '#5A8BE0', '#E0607E'];

export function useCategorical(): string[] {
  return useTheme().dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
}

export function LegendItem({ color, text, dashed, value }: { color: string; text: string; dashed?: boolean; value?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {dashed !== undefined ? (
        <View style={{ width: 14, height: 0, borderTopWidth: 2, borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }} />
      ) : (
        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      )}
      <Text style={{ fontSize: 12, color: t.c.inkSoft }}>{text}</Text>
      {value ? <Text style={{ fontSize: 12, color: t.c.ink, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</Text> : null}
    </View>
  );
}

// ------------------------------------------------------------------ line chart

export type LineSeries = { key: string; label: string; color: string; values: number[]; dashed?: boolean };

/**
 * One y-axis, 2px lines, end-point dots, recessive zero/min/max guides. Tap or drag to scrub:
 * a crosshair and a readout of every series at that point.
 */
export function LineChart({
  labels,
  series,
  width,
  height = 160,
  format,
  summary,
  includeZero,
}: {
  labels: string[];
  series: LineSeries[];
  width: number;
  height?: number;
  format: (v: number) => string;
  summary: string;
  includeZero?: boolean;
}) {
  const t = useTheme();
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  if (n < 2 || width <= 0) return null;
  const padL = 52;
  const padR = 12;
  const padT = 12;
  const padB = 22;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const all = series.flatMap((s) => s.values);
  let max = Math.max(...all);
  let min = Math.min(...all);
  if (includeZero) {
    max = Math.max(0, max);
    min = Math.min(0, min);
  }
  const pad = (max - min) * 0.08 || 1;
  max += pad;
  min = includeZero && min === 0 ? 0 : min - pad;
  const span = max - min || 1;
  const x = (i: number) => padL + (i / (n - 1)) * w;
  const y = (v: number) => padT + ((max - v) / span) * h;
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const pick = (e: GestureResponderEvent) => {
    const lx = e.nativeEvent.locationX;
    const i = Math.round(((lx - padL) / w) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const ticks = [max - pad, (max + min) / 2, min + (includeZero && min === 0 ? 0 : pad)];
  const mid = Math.floor((n - 1) / 2);
  return (
    <View style={{ gap: 6 }}>
      <View
        accessible
        accessibilityLabel={summary}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderRelease={() => setTimeout(() => setHover(null), 2500)}
      >
        <Svg width={width} height={height}>
          {ticks.map((v, i) => (
            <G key={i}>
              <Line x1={padL} x2={padL + w} y1={y(v)} y2={y(v)} stroke={t.c.line} strokeWidth={1} />
              <SvgText x={padL - 6} y={y(v) + 4} fontSize={10} fill={t.c.inkSoft} textAnchor="end">
                {format(v)}
              </SvgText>
            </G>
          ))}
          {includeZero && min < 0 ? <Line x1={padL} x2={padL + w} y1={y(0)} y2={y(0)} stroke={t.c.inkSoft} strokeDasharray="2 3" /> : null}
          {series.map((s) => (
            <Path key={s.key} d={path(s.values)} stroke={s.color} strokeWidth={2} fill="none" strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" />
          ))}
          {series.map((s) => (
            <Circle key={`e${s.key}`} cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r={4} fill={s.color} stroke={t.c.surface} strokeWidth={2} />
          ))}
          {hover !== null ? (
            <G>
              <Line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + h} stroke={t.c.inkSoft} strokeWidth={1} />
              {series.map((s) => (
                <Circle key={`h${s.key}`} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} fill={s.color} stroke={t.c.surface} strokeWidth={2} />
              ))}
            </G>
          ) : null}
          {[0, mid, n - 1].map((i) => (
            <SvgText key={`x${i}`} x={x(i)} y={height - 6} fontSize={10} fill={t.c.inkSoft} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
              {labels[i]}
            </SvgText>
          ))}
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, minHeight: 18 }}>
        {hover !== null ? (
          <>
            <Text style={{ fontSize: 12, color: t.c.ink, fontWeight: '800' }}>{labels[hover]}</Text>
            {series.map((s) => (
              <LegendItem key={s.key} color={s.color} dashed={!!s.dashed} text={s.label} value={format(s.values[hover] ?? 0)} />
            ))}
          </>
        ) : series.length > 1 ? (
          series.map((s) => <LegendItem key={s.key} color={s.color} dashed={!!s.dashed} text={s.label} value={format(s.values[n - 1] ?? 0)} />)
        ) : (
          <Text style={{ fontSize: 11, color: t.c.inkSoft }}>Tap or drag the chart to read a point.</Text>
        )}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ donut

export type Slice = { key: string; label: string; value: number; color: string };

export function Donut({ slices, size = 150, center, summary }: { slices: Slice[]; size?: number; center?: ReactNode; summary: string }) {
  const t = useTheme();
  const total = slices.reduce((s, x) => s + x.value, 0);
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = size / 2;
  let a0 = -Math.PI / 2;
  const arcs = slices.map((s) => {
    const a1 = a0 + (total > 0 ? (s.value / total) * Math.PI * 2 : 0);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = `M${c + r * Math.cos(a0)},${c + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${c + r * Math.cos(a1)},${c + r * Math.sin(a1)}`;
    const seg = { s, d, start: a0 };
    a0 = a1;
    return seg;
  });
  return (
    <View accessible accessibilityLabel={summary} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {arcs.map(({ s, d }) => (
          <Path key={s.key} d={d} stroke={s.color} strokeWidth={stroke} fill="none" />
        ))}
        {/* 2px surface gaps between segments */}
        {arcs.length > 1
          ? arcs.map(({ s, start }) => (
              <Line
                key={`g${s.key}`}
                x1={c + (r - stroke / 2 - 1) * Math.cos(start)}
                y1={c + (r - stroke / 2 - 1) * Math.sin(start)}
                x2={c + (r + stroke / 2 + 1) * Math.cos(start)}
                y2={c + (r + stroke / 2 + 1) * Math.sin(start)}
                stroke={t.c.surface}
                strokeWidth={2}
              />
            ))
          : null}
      </Svg>
      {center}
    </View>
  );
}

// ------------------------------------------------------------------ bars

export type Bar = { key: string; label: string; value: number; color?: string; faded?: boolean };

/** Vertical bars from a zero baseline, 4px rounded ends, 2px gaps; tap a bar to read it. */
export function BarChart({ bars, width, height = 140, format, summary }: { bars: Bar[]; width: number; height?: number; format: (v: number) => string; summary: string }) {
  const t = useTheme();
  const [sel, setSel] = useState<number | null>(null);
  if (!bars.length || width <= 0) return null;
  const padT = 18;
  const padB = 20;
  const h = height - padT - padB;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const gap = Math.max(2, Math.min(10, width / bars.length / 4));
  const bw = (width - gap * (bars.length - 1)) / bars.length;
  const every = Math.ceil(bars.length / 7);
  return (
    <View style={{ gap: 4 }}>
      <View accessible accessibilityLabel={summary}>
        <Svg width={width} height={height}>
          <Line x1={0} x2={width} y1={padT + h} y2={padT + h} stroke={t.c.line} strokeWidth={1} />
          {bars.map((b, i) => {
            const bh = Math.max(2, (b.value / max) * h);
            const x0 = i * (bw + gap);
            const y0 = padT + h - bh;
            const rr = Math.min(4, bw / 2, bh);
            const d = `M${x0},${padT + h} L${x0},${y0 + rr} Q${x0},${y0} ${x0 + rr},${y0} L${x0 + bw - rr},${y0} Q${x0 + bw},${y0} ${x0 + bw},${y0 + rr} L${x0 + bw},${padT + h} Z`;
            return (
              <G key={b.key} onPress={() => setSel(sel === i ? null : i)}>
                <Rect x={x0 - gap / 2} y={0} width={bw + gap} height={height} fill="transparent" />
                <Path d={d} fill={b.color ?? t.c.primary} opacity={b.faded ? 0.45 : sel === null || sel === i ? 1 : 0.55} />
                {sel === i ? (
                  <SvgText x={x0 + bw / 2} y={Math.max(11, y0 - 5)} fontSize={11} fontWeight="800" fill={t.c.ink} textAnchor="middle">
                    {format(b.value)}
                  </SvgText>
                ) : null}
                {i % every === 0 || i === bars.length - 1 ? (
                  <SvgText x={x0 + bw / 2} y={height - 5} fontSize={10} fill={t.c.inkSoft} textAnchor="middle">
                    {b.label}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      </View>
      <Text style={{ fontSize: 11, color: t.c.inkSoft }}>{sel === null ? 'Tap a bar to read it.' : `${bars[sel]!.label}: ${format(bars[sel]!.value)}`}</Text>
    </View>
  );
}

// ------------------------------------------------------------------ progress ring

export function ProgressRing({ progress, size = 84, color, label, sub }: { progress: number; size?: number; color?: string; label: string; sub?: string }) {
  const t = useTheme();
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, progress));
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${label}: ${Math.round(frac * 100)}%`} accessibilityValue={{ min: 0, max: 100, now: Math.round(frac * 100) }} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.c.surfaceAlt} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color ?? t.c.primary} strokeWidth={stroke} fill="none" strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - frac)} strokeLinecap="round" />
      </Svg>
      <Text style={{ fontSize: 17, fontWeight: '900', color: t.c.ink, fontVariant: ['tabular-nums'] }}>{Math.round(frac * 100)}%</Text>
      {sub ? <Text style={{ fontSize: 9, fontWeight: '700', color: t.c.inkSoft }}>{sub}</Text> : null}
    </View>
  );
}

/** Two thin horizontal bars: this month vs the month before. */
export function PairBar({ current, prior, max, color }: { current: number; prior: number; max: number; color: string }) {
  const t = useTheme();
  const w = (v: number) => `${Math.max(1, (v / Math.max(1, max)) * 100)}%` as `${number}%`;
  return (
    <View style={{ gap: 3 }}>
      <View style={{ height: 8, backgroundColor: t.c.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ width: w(current), height: '100%', backgroundColor: color, borderRadius: 4 }} />
      </View>
      <View style={{ height: 4, backgroundColor: t.c.surfaceAlt, borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ width: w(prior), height: '100%', backgroundColor: t.c.inkSoft, opacity: 0.6, borderRadius: 2 }} />
      </View>
    </View>
  );
}
