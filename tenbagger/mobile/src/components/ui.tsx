import type { ReactNode } from 'react';
import { Pressable, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export function Title({ children, style, size = 28 }: { children: ReactNode; style?: StyleProp<TextStyle>; size?: number }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="header" style={[{ fontFamily: t.fonts.display, fontSize: size, fontWeight: '700', color: t.c.ink, letterSpacing: -0.4 }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, style, soft, size = 15, weight }: { children: ReactNode; style?: StyleProp<TextStyle>; soft?: boolean; size?: number; weight?: TextStyle['fontWeight'] }) {
  const t = useTheme();
  return (
    <Text style={[{ fontFamily: t.fonts.body, fontSize: size, lineHeight: Math.round(size * 1.45), color: soft ? t.c.inkSoft : t.c.ink, fontWeight: weight }, style]}>
      {children}
    </Text>
  );
}

export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  const t = useTheme();
  return (
    <Text style={{ fontFamily: t.fonts.body, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: color ?? t.c.inkSoft }}>
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.c.line, padding: 16 }, style]}>
      {children}
    </View>
  );
}

type BtnProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
};

/** Chunky button with a "pressed-in" bottom edge. */
export function Button({ label, variant = 'primary', style, disabled, icon, ...rest }: BtnProps) {
  const t = useTheme();
  const bg =
    variant === 'primary' ? t.c.primary : variant === 'danger' ? t.c.danger : variant === 'secondary' ? t.c.surface : 'transparent';
  const fg = variant === 'primary' ? t.c.primaryInk : variant === 'danger' ? '#fff' : variant === 'secondary' ? t.c.ink : t.c.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        {
          backgroundColor: disabled ? t.c.locked : bg,
          borderRadius: t.radius.md,
          paddingVertical: 15,
          paddingHorizontal: 20,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          borderColor: t.c.line,
          borderBottomWidth: variant === 'ghost' ? 0 : pressed ? 1.5 : 4,
          borderBottomColor: variant === 'secondary' ? t.c.line : 'rgba(0,0,0,0.22)',
          transform: [{ translateY: pressed && variant !== 'ghost' ? 2 : 0 }],
          opacity: disabled ? 0.8 : 1,
        },
        style,
      ]}
    >
      {icon}
      <Text style={{ color: disabled ? t.c.inkSoft : fg, fontFamily: t.fonts.body, fontWeight: '800', fontSize: 16, letterSpacing: 0.3 }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, accessibilityLabel, style }: { label: string; selected?: boolean; onPress?: () => void; accessibilityLabel?: string; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: t.radius.pill,
          backgroundColor: selected ? t.c.ink : t.c.surface,
          borderWidth: 1,
          borderColor: selected ? t.c.ink : t.c.line,
        },
        style,
      ]}
    >
      <Text style={{ color: selected ? t.c.bg : t.c.ink, fontWeight: '700', fontSize: 13, fontFamily: t.fonts.body }}>{label}</Text>
    </Pressable>
  );
}

export function Disclaimer({ compact }: { compact?: boolean }) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Educational only. Not investment advice."
      style={{ paddingVertical: compact ? 6 : 10, paddingHorizontal: 12, borderRadius: t.radius.sm, backgroundColor: t.c.accentSoft, alignItems: 'center' }}
    >
      <Text style={{ color: t.c.ink, fontSize: 12, fontWeight: '700', fontFamily: t.fonts.body }}>Educational only. Not investment advice.</Text>
    </View>
  );
}

export function ProgressBar({ value, color, height = 12, label }: { value: number; color?: string; height?: number; label?: string }) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height, backgroundColor: t.c.surfaceAlt, borderRadius: height, overflow: 'hidden', flex: 1 }}
    >
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color ?? t.c.primary, borderRadius: height }} />
    </View>
  );
}
