/** Small building blocks for the budget screens and onboarding. Shame-free: amber, never red. */
import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from '../components/Icon';
import { useTheme } from '../theme';
import { formatUSD, LABEL_TEXT, type MathLine, type NumberLabel } from './engine';

export function LabelChip({ label }: { label: NumberLabel }) {
  const t = useTheme();
  const s: Record<NumberLabel, { bg: string; fg: string; border: string }> = {
    verified: { bg: t.c.primarySoft, fg: t.c.primary, border: t.c.primarySoft },
    manual: { bg: t.c.surfaceAlt, fg: t.c.inkSoft, border: t.c.surfaceAlt },
    projected: { bg: 'transparent', fg: t.c.ink, border: t.c.inkSoft },
    pending: { bg: t.c.accentSoft, fg: t.c.accent, border: t.c.accent },
    estimate: { bg: 'transparent', fg: t.c.inkSoft, border: t.c.line },
  };
  const x = s[label];
  return (
    <View accessibilityLabel={LABEL_TEXT[label].toLowerCase()} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: x.bg, borderWidth: 1, borderColor: x.border, borderStyle: label === 'verified' || label === 'manual' ? 'solid' : 'dashed' }}>
      <Text style={{ color: x.fg, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }}>{LABEL_TEXT[label]}</Text>
    </View>
  );
}

export function MathList({ lines }: { lines: MathLine[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: 2 }}>
      {lines.map((l, i) => (
        <View key={`${l.label}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderTopWidth: l.op === '=' ? 1 : 0, borderTopColor: t.c.line }}>
          <Text style={{ width: 14, color: t.c.inkSoft, fontWeight: '800' }}>{l.op === '=' ? '=' : l.amount < 0 ? '−' : '+'}</Text>
          <Text style={{ flex: 1, color: l.op === '=' ? t.c.ink : t.c.inkSoft, fontSize: 13, fontWeight: l.op === '=' ? '800' : '500' }}>{l.label}</Text>
          <LabelChip label={l.basis} />
          <Text style={{ minWidth: 64, textAlign: 'right', color: t.c.ink, fontSize: 14, fontWeight: l.op === '=' ? '900' : '700', fontVariant: ['tabular-nums'] }}>{formatUSD(Math.abs(l.amount), { cents: false })}</Text>
        </View>
      ))}
    </View>
  );
}

export function KV({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
      <Text style={{ flex: 1, color: strong ? t.c.ink : t.c.inkSoft, fontSize: 13, fontWeight: strong ? '800' : '500' }}>{label}</Text>
      <Text style={{ color: t.c.ink, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'], textAlign: 'right', flexShrink: 1 }}>{value}</Text>
    </View>
  );
}

export function SectionHead({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
      <View style={{ flex: 1, gap: 2 }}>
        {eyebrow ? <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }}>{eyebrow}</Text> : null}
        <Text style={{ color: t.c.ink, fontFamily: t.fonts.display, fontSize: 20, fontWeight: '700' }}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
      <Text style={{ color: t.c.primary, fontWeight: '800', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Tone bar: amber for "needs attention", green for wins, neutral otherwise. */
export function toneColor(t: ReturnType<typeof useTheme>, tone: 'info' | 'good' | 'amber'): { fg: string; bg: string } {
  if (tone === 'amber') return { fg: t.c.accent, bg: t.c.accentSoft };
  if (tone === 'good') return { fg: t.c.primary, bg: t.c.primarySoft };
  return { fg: t.c.inkSoft, bg: t.c.surfaceAlt };
}

export function Why({ children }: { children: ReactNode }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Why we ask" onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: t.radius.md, backgroundColor: t.c.surfaceAlt }}>
      <Icon name="info" size={16} color={t.c.inkSoft} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 13 }}>Why we ask {open ? '▴' : '▾'}</Text>
        {open ? <Text style={{ color: t.c.inkSoft, fontSize: 13, lineHeight: 19 }}>{children}</Text> : null}
      </View>
    </Pressable>
  );
}

export function PrivacyNote() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 4 }}>
      <Icon name="lock" size={14} color={t.c.inkSoft} />
      <Text style={{ flex: 1, color: t.c.inkSoft, fontSize: 12, lineHeight: 17 }}>Your answers stay on this device until you choose to link accounts.</Text>
    </View>
  );
}

/** Big friendly dollar input. */
export function MoneyField({ label, value, onChange, placeholder, hint, autoFocus }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string; hint?: string; autoFocus?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 14 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: t.c.line, borderRadius: t.radius.md, backgroundColor: t.c.surface, paddingHorizontal: 14 }}>
        <Text style={{ color: t.c.inkSoft, fontSize: 28, fontWeight: '800' }}>$</Text>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={(s) => onChange(s.replace(/[^0-9.,]/g, ''))}
          placeholder={placeholder ?? '0'}
          placeholderTextColor={t.c.locked}
          keyboardType="decimal-pad"
          inputMode="decimal"
          autoFocus={autoFocus}
          style={{ flex: 1, minWidth: 0, fontSize: 30, fontWeight: '800', color: t.c.ink, paddingVertical: 12, paddingHorizontal: 6, fontVariant: ['tabular-nums'] }}
        />
      </View>
      {hint ? <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{hint}</Text> : null}
    </View>
  );
}

export function TextField({ label, value, onChange, placeholder, numeric, style }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string; numeric?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ gap: 4 }, style]}>
      <Text style={{ color: t.c.inkSoft, fontWeight: '700', fontSize: 12 }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.c.locked}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        inputMode={numeric ? 'decimal' : 'text'}
        style={{ borderWidth: 1.5, borderColor: t.c.line, borderRadius: t.radius.sm, backgroundColor: t.c.surface, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: t.c.ink, minWidth: 0 }}
      />
    </View>
  );
}

export function ChipRow<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T | null | undefined; onChange: (v: T) => void; label?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ color: t.c.inkSoft, fontWeight: '700', fontSize: 12 }}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const sel = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
              onPress={() => onChange(o.value)}
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: t.radius.pill, borderWidth: 1.5, borderColor: sel ? t.c.ink : t.c.line, backgroundColor: sel ? t.c.ink : t.c.surface }}
            >
              <Text style={{ color: sel ? t.c.bg : t.c.ink, fontWeight: '700', fontSize: 13 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Toggle({ label, value, onChange, detail }: { label: string; value: boolean; onChange: (v: boolean) => void; detail?: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
      <View style={{ width: 42, height: 26, borderRadius: 13, backgroundColor: value ? t.c.primary : t.c.locked, padding: 3, alignItems: value ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.c.ink, fontWeight: '700', fontSize: 14 }}>{label}</Text>
        {detail ? <Text style={{ color: t.c.inkSoft, fontSize: 12, lineHeight: 17 }}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Selectable card with a title and plain explanation (goals, styles, comfort). */
export function OptionCard({ title, body, selected, onPress, badge, children }: { title: string; body?: string; selected: boolean; onPress: () => void; badge?: string; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ borderWidth: 2, borderColor: selected ? t.c.primary : t.c.line, borderRadius: t.radius.md, backgroundColor: selected ? t.c.primarySoft : t.c.surface, overflow: 'hidden' }}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={title} onPress={onPress} style={{ padding: 14, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? t.c.primary : t.c.locked, backgroundColor: selected ? t.c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {selected ? <Icon name="check" size={14} color={t.c.primaryInk} /> : null}
          </View>
          <Text style={{ flex: 1, color: t.c.ink, fontWeight: '800', fontSize: 16 }}>{title}</Text>
          {badge ? (
            <View style={{ backgroundColor: t.c.accentSoft, borderRadius: t.radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: t.c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 }}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {body ? <Text style={{ color: t.c.inkSoft, fontSize: 13, lineHeight: 19, marginLeft: 30 }}>{body}</Text> : null}
      </Pressable>
      {selected && children ? <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>{children}</View> : null}
    </View>
  );
}

export function Meter({ value, color, height = 10 }: { value: number; color?: string; height?: number }) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, backgroundColor: t.c.surfaceAlt, borderRadius: height, overflow: 'hidden', flex: 1 }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color ?? t.c.primary, borderRadius: height }} />
    </View>
  );
}
