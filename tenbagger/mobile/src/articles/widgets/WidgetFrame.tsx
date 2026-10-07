import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Tag } from '../components/Tag';

type Props = {
  eyebrow: string;
  title?: string;
  caption?: string;
  sample?: boolean;
  samplePrice?: boolean;
  real?: string;
  children: ReactNode;
  accessibilityLabel?: string;
};

/** Shared card chrome for every article widget: eyebrow, optional title, data-provenance tags, caption. */
export function WidgetFrame({ eyebrow, title, caption, sample, samplePrice, real, children, accessibilityLabel }: Props) {
  const t = useTheme();
  const tags = (sample || samplePrice || real) && (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {real && !sample && <Tag label={real} tone="real" />}
      {sample && <Tag label="Sample data" tone="sample" />}
      {samplePrice && <Tag label="Sample price" tone="sample" />}
    </View>
  );
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={{ backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.c.line, padding: 16, gap: 12, marginVertical: 6 }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: t.c.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase', fontFamily: t.fonts.body }}>{eyebrow}</Text>
        {tags}
      </View>
      {title ? <Text style={{ color: t.c.ink, fontFamily: t.fonts.display, fontSize: 18, fontWeight: '700', lineHeight: 23 }}>{title}</Text> : null}
      {children}
      {caption ? <Text style={{ color: t.c.inkSoft, fontSize: 13, lineHeight: 18, fontStyle: 'italic', fontFamily: t.fonts.body }}>{caption}</Text> : null}
    </View>
  );
}

export function Unsupported({ reason }: { reason: string }) {
  const t = useTheme();
  return (
    <View style={{ borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: t.c.line, padding: 12 }}>
      <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>This interactive piece isn't available in this version of the app ({reason}).</Text>
    </View>
  );
}

/** A labelled result figure used by the calculators. */
export function Stat({ label, value, big, tone }: { label: string; value: string; big?: boolean; tone?: 'good' | 'warn' | 'bad' }) {
  const t = useTheme();
  const color = tone === 'good' ? t.c.primary : tone === 'warn' ? t.c.accent : tone === 'bad' ? t.c.danger : t.c.ink;
  return (
    <View style={{ flex: 1, minWidth: 96, gap: 2 }}>
      <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '700', fontFamily: t.fonts.body }}>{label}</Text>
      <Text style={{ color, fontSize: big ? 26 : 18, fontWeight: '800', fontVariant: ['tabular-nums'], fontFamily: big ? t.fonts.display : t.fonts.body }}>{value}</Text>
    </View>
  );
}
