/** Small building blocks shared by the dashboard tabs. */
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from '../../components/Icon';
import { Card } from '../../components/ui';
import { useTheme } from '../../theme';
import { LabelChip, Money, SectionTitle } from '../components';
import type { NumberLabel } from '../engine';

/** Renders children with the measured width (charts need a pixel width). */
export function Measure({ children, height = 160 }: { children: (w: number) => ReactNode; height?: number }) {
  const [w, setW] = useState(0);
  return <View onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))}>{w > 0 ? children(w) : <View style={{ height }} />}</View>;
}

export function Panel({ eyebrow, title, right, children, style }: { eyebrow?: string; title: string; right?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Card style={[{ gap: 12 }, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <SectionTitle eyebrow={eyebrow} title={title} />
        </View>
        {right}
      </View>
      {children}
    </Card>
  );
}

export function Stat({ label, value, basis, sub, tone, signed, style }: { label: string; value: number; basis?: NumberLabel; sub?: string; tone?: string; signed?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ flexGrow: 1, flexBasis: 140, borderWidth: 1, borderColor: t.c.line, borderLeftWidth: tone ? 4 : 1, borderLeftColor: tone ?? t.c.line, borderRadius: t.radius.md, padding: 12, gap: 4, backgroundColor: t.c.surface }, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', flexShrink: 1 }}>{label}</Text>
        {basis ? <LabelChip label={basis} small /> : null}
      </View>
      <Money value={value} size={22} weight="900" signed={signed} />
      {sub ? <Text style={{ color: t.c.inkSoft, fontSize: 12, lineHeight: 16 }}>{sub}</Text> : null}
    </View>
  );
}

/** Label … value row with an optional chip. */
export function KV({ label, value, basis, strong, color }: { label: string; value: string; basis?: NumberLabel; strong?: boolean; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 }}>
      <Text style={{ flex: 1, color: strong ? t.c.ink : t.c.inkSoft, fontSize: 14, fontWeight: strong ? '800' : '500' }}>{label}</Text>
      {basis ? <LabelChip label={basis} small /> : null}
      <Text style={{ color: color ?? t.c.ink, fontSize: 14, fontWeight: strong ? '900' : '700', fontVariant: ['tabular-nums'], minWidth: 70, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.c.line }} />;
}

/** Outlined pill that navigates somewhere (lesson, X-ray, company page, another tab). */
export function LinkPill({ label, href, onPress, icon = 'book', a11y }: { label: string; href?: string; onPress?: () => void; icon?: IconName; a11y?: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={a11y ?? label}
      onPress={onPress ?? (() => href && router.push(href as never))}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: t.radius.pill,
        borderWidth: 1.5,
        borderColor: t.c.primary,
        backgroundColor: pressed ? t.c.primarySoft : 'transparent',
      })}
    >
      <Icon name={icon} color={t.c.primary} size={15} />
      <Text style={{ color: t.c.primary, fontWeight: '800', fontSize: 13 }}>{label}</Text>
      <Icon name="chevron" color={t.c.primary} size={13} />
    </Pressable>
  );
}

/** Plain-English callout ("What this means"). */
export function Explainer({ title, children, tone }: { title: string; children: ReactNode; tone?: 'info' | 'warn' }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: tone === 'warn' ? t.c.accentSoft : t.c.surfaceAlt, borderRadius: t.radius.md, padding: 12, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="info" color={tone === 'warn' ? t.c.accent : t.c.inkSoft} size={15} />
        <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 13 }}>{title}</Text>
      </View>
      {typeof children === 'string' ? <Text style={{ color: t.c.ink, fontSize: 13, lineHeight: 19 }}>{children}</Text> : children}
    </View>
  );
}

/** Row of choice chips (filters). */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.id)}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: t.radius.pill, backgroundColor: on ? t.c.ink : t.c.surface, borderWidth: 1, borderColor: on ? t.c.ink : t.c.line }}
          >
            <Text style={{ color: on ? t.c.bg : t.c.ink, fontWeight: '700', fontSize: 12 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Two-column grid on wide screens, one column on phones. */
export function Grid({ wide, children, min = 300 }: { wide: boolean; children: ReactNode; min?: number }) {
  return <View style={{ flexDirection: wide ? 'row' : 'column', flexWrap: 'wrap', gap: 14, alignItems: wide ? 'flex-start' : 'stretch' }}>{wrap(children, wide, min)}</View>;
}

function wrap(children: ReactNode, wide: boolean, min: number): ReactNode {
  if (!wide) return children;
  return (Array.isArray(children) ? children : [children]).filter(Boolean).map((c, i) => (
    <View key={i} style={{ flexGrow: 1, flexBasis: min, minWidth: min }}>
      {c}
    </View>
  ));
}

export function pct(r: number | null | undefined, digits = 0): string {
  return r === null || r === undefined || !Number.isFinite(r) ? '—' : `${(r * 100).toFixed(digits)}%`;
}
