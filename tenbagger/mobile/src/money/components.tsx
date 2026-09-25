import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme';
import { formatUSD, LABEL_TEXT, shortDate, type Grade, type NumberLabel, type RunwayPoint, type Verdict } from './engine';

/** Tab-bar icon: a wallet (kept local so the shared Icon set stays untouched). */
export function MoneyIcon({ color, size = 24 }: { color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M4 7h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z" {...p} />
      <Path d="M4 7l11-3.5V7M16 13.5h4" {...p} />
      <Circle cx="16" cy="13.5" r="0.6" {...p} />
    </Svg>
  );
}

/** Honest label on a number: VERIFIED / MANUAL / PROJECTED / PENDING / ESTIMATE. */
export function LabelChip({ label, small }: { label: NumberLabel; small?: boolean }) {
  const t = useTheme();
  const style: Record<NumberLabel, { bg: string; fg: string; border: string; dashed?: boolean }> = {
    verified: { bg: t.c.primarySoft, fg: t.c.primary, border: t.c.primarySoft },
    manual: { bg: t.c.surfaceAlt, fg: t.c.inkSoft, border: t.c.surfaceAlt },
    projected: { bg: 'transparent', fg: t.c.ink, border: t.c.inkSoft, dashed: true },
    pending: { bg: t.c.accentSoft, fg: t.c.accent, border: t.c.accent, dashed: true },
    estimate: { bg: 'transparent', fg: t.c.inkSoft, border: t.c.line, dashed: true },
  };
  const s = style[label];
  return (
    <View
      accessibilityLabel={LABEL_TEXT[label].toLowerCase()}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: s.bg,
        borderColor: s.border,
        borderWidth: 1,
        borderStyle: s.dashed ? 'dashed' : 'solid',
        borderRadius: 999,
        paddingHorizontal: small ? 6 : 8,
        paddingVertical: small ? 1 : 2,
      }}
    >
      <Text style={{ color: s.fg, fontSize: small ? 9 : 10, fontWeight: '800', letterSpacing: 0.8 }}>{LABEL_TEXT[label]}</Text>
    </View>
  );
}

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  const t = useTheme();
  const m: Record<Verdict, { text: string; bg: string; fg: string }> = {
    covered: { text: "You're fine", bg: t.c.primary, fg: t.c.primaryInk },
    covered_minimum_only: { text: 'Minimum only', bg: t.c.accent, fg: t.dark ? t.c.bg : '#fff' },
    short: { text: 'Short', bg: t.c.danger, fg: '#fff' },
  };
  const v = m[verdict];
  return (
    <View accessibilityLabel={`Verdict: ${v.text}`} style={{ backgroundColor: v.bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' }}>
      <Text style={{ color: v.fg, fontWeight: '900', fontSize: 13 }}>{v.text}</Text>
    </View>
  );
}

export function GradeBadge({ grade, size = 40 }: { grade: Grade | null; size?: number }) {
  const t = useTheme();
  const color = grade === null ? t.c.locked : grade === 'A' || grade === 'B' ? t.c.primary : grade === 'C' ? t.c.accent : t.c.danger;
  return (
    <View
      accessibilityLabel={grade ? `Grade ${grade}` : 'Not graded yet'}
      style={{ width: size, height: size, borderRadius: size / 4, borderWidth: 2, borderColor: color, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color, fontFamily: t.fonts.display, fontWeight: '700', fontSize: size * 0.55 }}>{grade ?? '–'}</Text>
    </View>
  );
}

export function Money({ value, size = 16, color, weight = '800', signed }: { value: number; size?: number; color?: string; weight?: '700' | '800' | '900'; signed?: boolean }) {
  const t = useTheme();
  return (
    <Text style={{ fontSize: size, fontWeight: weight, color: color ?? t.c.ink, fontVariant: ['tabular-nums'] }}>
      {formatUSD(value, { signed })}
    </Text>
  );
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 2 }}>
      {eyebrow ? <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: t.c.inkSoft }}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={{ fontFamily: t.fonts.display, fontSize: 21, fontWeight: '700', color: t.c.ink }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * Projected cash per day if each statement is paid in full (solid) or only the minimum (dashed).
 * Green dots = pay landing, red ticks = due dates. Below-zero area shaded.
 */
export function RunwayChart({ runway, width, height = 140 }: { runway: RunwayPoint[]; width: number; height?: number }) {
  const t = useTheme();
  if (runway.length < 2 || width <= 0) return null;
  const padL = 44;
  const padR = 8;
  const padT = 10;
  const padB = 22;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const vals = runway.flatMap((p) => [p.payInFull, p.payMinimum]);
  const max = Math.max(0, ...vals);
  const min = Math.min(0, ...vals);
  const span = max - min || 1;
  const x = (i: number) => padL + (i / (runway.length - 1)) * w;
  const y = (v: number) => padT + ((max - v) / span) * h;
  const step = (key: 'payInFull' | 'payMinimum') =>
    runway.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(i === 0 ? p[key] : runway[i - 1]![key]).toFixed(1)} L${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const low = runway.reduce((a, b) => (b.payInFull < a.payInFull ? b : a));
  const summary = `Projected cash from ${shortDate(runway[0]!.date)} to ${shortDate(runway[runway.length - 1]!.date)}. Lowest point ${formatUSD(low.payInFull)} on ${shortDate(low.date)} if the card is paid in full.`;
  const midIdx = Math.floor((runway.length - 1) / 2);
  return (
    <View accessible accessibilityLabel={summary}>
      <Svg width={width} height={height}>
        {min < 0 && <Rect x={padL} y={y(0)} width={w} height={y(min) - y(0)} fill={t.c.dangerSoft} />}
        <Line x1={padL} x2={padL + w} y1={y(0)} y2={y(0)} stroke={t.c.inkSoft} strokeWidth={1} strokeDasharray="2 3" />
        <SvgText x={padL - 6} y={y(max) + 4} fontSize={10} fill={t.c.inkSoft} textAnchor="end">{formatUSD(max)}</SvgText>
        <SvgText x={padL - 6} y={y(0) + 4} fontSize={10} fill={t.c.inkSoft} textAnchor="end">$0</SvgText>
        {runway.map((p, i) =>
          p.events.map((e, j) =>
            e.kind === 'due' ? (
              <Line key={`d${i}-${j}`} x1={x(i)} x2={x(i)} y1={padT} y2={padT + h} stroke={t.c.danger} strokeWidth={1.5} strokeDasharray="3 3" />
            ) : null,
          ),
        )}
        <Path d={step('payMinimum')} stroke={t.c.inkSoft} strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
        <Path d={step('payInFull')} stroke={t.c.primary} strokeWidth={2.5} fill="none" />
        {runway.map((p, i) =>
          p.events
            .filter((e) => e.kind === 'deposit')
            .map((e, j) => (
              <Circle key={`c${i}-${j}`} cx={x(i)} cy={y(p.payInFull)} r={4} fill={e.basis === 'pending' ? t.c.accent : t.c.primary} stroke={t.c.surface} strokeWidth={1.5} />
            )),
        )}
        {[0, midIdx, runway.length - 1].map((i) => (
          <SvgText key={`x${i}`} x={x(i)} y={height - 6} fontSize={10} fill={t.c.inkSoft} textAnchor={i === 0 ? 'start' : i === runway.length - 1 ? 'end' : 'middle'}>
            {shortDate(runway[i]!.date)}
          </SvgText>
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
        <Legend color={t.c.primary} text="Pay card in full" />
        <Legend color={t.c.inkSoft} text="Pay minimum" dashed />
        <Legend color={t.c.danger} text="Due date" dashed />
        <Legend color={t.c.accent} text="Pending pay" dot />
      </View>
    </View>
  );
}

function Legend({ color, text, dashed, dot }: { color: string; text: string; dashed?: boolean; dot?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {dot ? (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      ) : (
        <View style={{ width: 14, height: 0, borderTopWidth: 2, borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }} />
      )}
      <Text style={{ fontSize: 11, color: t.c.inkSoft }}>{text}</Text>
    </View>
  );
}
