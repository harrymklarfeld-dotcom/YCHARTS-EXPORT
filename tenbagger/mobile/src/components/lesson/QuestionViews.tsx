import { Pressable, Text, View } from 'react-native';
import { getCompany } from '../../data';
import type { UsdScale } from '../../game';
import type { CompareQuestion, MultipleChoiceQuestion, NumericQuestion, OrderQuestion, TrueFalseQuestion } from '../../types/contract';
import { useTheme } from '../../theme';
import { Icon } from '../Icon';

type Locked = { locked: boolean };

function Option({ label, selected, onPress, disabled, a11y, big }: { label: string; selected: boolean; onPress: () => void; disabled: boolean; a11y?: string; big?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        borderWidth: 2,
        borderColor: selected ? t.c.primary : t.c.line,
        backgroundColor: selected ? t.c.primarySoft : t.c.surface,
        borderRadius: t.radius.md,
        paddingVertical: big ? 22 : 16,
        paddingHorizontal: 16,
        borderBottomWidth: pressed ? 2 : 4,
      })}
    >
      <Text style={{ color: t.c.ink, fontSize: big ? 20 : 17, fontWeight: '700', textAlign: big ? 'center' : 'left', fontVariant: ['tabular-nums'] }}>{label}</Text>
    </Pressable>
  );
}

export function MultipleChoiceView({ q, value, onChange, locked }: { q: MultipleChoiceQuestion; value: number | null; onChange: (i: number) => void } & Locked) {
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
      {q.choices.map((c, i) => (
        <Option key={i} label={c} selected={value === i} onPress={() => onChange(i)} disabled={locked} />
      ))}
    </View>
  );
}

export function TrueFalseView({ value, onChange, locked }: { q: TrueFalseQuestion; value: boolean | null; onChange: (v: boolean) => void } & Locked) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Option big label="True" selected={value === true} onPress={() => onChange(true)} disabled={locked} />
      </View>
      <View style={{ flex: 1 }}>
        <Option big label="False" selected={value === false} onPress={() => onChange(false)} disabled={locked} />
      </View>
    </View>
  );
}

export function CompareView({ q, value, onChange, locked }: { q: CompareQuestion; value: number | null; onChange: (i: number) => void } & Locked) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10 }}>
      {q.choices.map((c, i) => {
        const co = getCompany(c);
        const selected = value === i;
        return (
          <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {i > 0 && (
              <Text style={{ fontFamily: t.fonts.display, fontStyle: 'italic', color: t.c.inkSoft, fontSize: 16 }}>vs</Text>
            )}
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={co ? `${c}, ${co.name}` : c}
              accessibilityState={{ checked: selected, disabled: locked }}
              disabled={locked}
              onPress={() => onChange(i)}
              style={{
                flex: 1,
                minHeight: 140,
                borderWidth: 2,
                borderBottomWidth: 5,
                borderColor: selected ? t.c.primary : t.c.line,
                backgroundColor: selected ? t.c.primarySoft : t.c.surface,
                borderRadius: t.radius.lg,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 12,
                gap: 6,
              }}
            >
              <Text style={{ fontFamily: t.fonts.display, fontSize: 30, fontWeight: '700', color: t.c.ink }}>{c}</Text>
              {co && <Text numberOfLines={2} style={{ textAlign: 'center', color: t.c.inkSoft, fontSize: 12 }}>{co.name}</Text>}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

/** Tap-to-rank: tap items in order; tap a ranked item to un-rank it. */
export function OrderView({ q, value, onChange, locked }: { q: OrderQuestion; value: number[]; onChange: (v: number[]) => void } & Locked) {
  const t = useTheme();
  const toggle = (i: number) => {
    if (value.includes(i)) onChange(value.filter((x) => x !== i));
    else onChange([...value, i]);
  };
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>Tap items in order. Tap again to undo.</Text>
      {q.choices.map((c, i) => {
        const rank = value.indexOf(i);
        const ranked = rank >= 0;
        const co = getCompany(c);
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`${c}${co ? `, ${co.name}` : ''}${ranked ? `, ranked ${rank + 1}` : ', not ranked'}`}
            accessibilityState={{ disabled: locked, selected: ranked }}
            disabled={locked}
            onPress={() => toggle(i)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              borderWidth: 2,
              borderBottomWidth: 4,
              borderColor: ranked ? t.c.primary : t.c.line,
              backgroundColor: ranked ? t.c.primarySoft : t.c.surface,
              borderRadius: t.radius.md,
              padding: 14,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: ranked ? t.c.primary : 'transparent',
                borderWidth: ranked ? 0 : 2,
                borderColor: t.c.line,
                borderStyle: 'dashed',
              }}
            >
              <Text style={{ color: t.c.primaryInk, fontWeight: '900' }}>{ranked ? rank + 1 : ''}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 17 }}>{c}</Text>
              {co && <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{co.name}</Text>}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;

export function NumericView({
  q,
  value,
  onChange,
  scale,
  onScale,
  locked,
}: { q: NumericQuestion; value: string; onChange: (v: string) => void; scale: UsdScale; onScale: (s: UsdScale) => void } & Locked) {
  const t = useTheme();
  const press = (k: (typeof KEYS)[number]) => {
    if (k === 'del') return onChange(value.slice(0, -1));
    if (k === '.' && value.includes('.')) return;
    if (value.replace('-', '').length >= 12) return;
    onChange(value === '0' && k !== '.' ? k : value + k);
  };
  const toggleSign = () => onChange(value.startsWith('-') ? value.slice(1) : `-${value}`);
  const scaleLabel = scale === 1e9 ? 'B' : scale === 1e6 ? 'M' : scale === 1e3 ? 'K' : '';
  const prefix = q.unit === 'usd' ? '$' : '';
  const suffix = q.unit === 'percent' ? '%' : q.unit === 'multiple' ? '×' : q.unit === 'usd' ? scaleLabel : '';
  return (
    <View style={{ gap: 12 }}>
      <View
        accessible
        accessibilityLabel={`Your answer: ${value || 'empty'} ${suffix}`}
        style={{ borderWidth: 2, borderColor: t.c.line, borderRadius: t.radius.md, backgroundColor: t.c.surface, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 34, fontWeight: '800', color: value ? t.c.ink : t.c.locked, fontVariant: ['tabular-nums'] }}>
          {prefix}
          {value || '0'}
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: t.c.inkSoft, marginLeft: 4 }}>{suffix}</Text>
      </View>
      {q.unit === 'usd' && (
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          {([
            [1e3, 'Thousand'],
            [1e6, 'Million'],
            [1e9, 'Billion'],
          ] as const).map(([s, l]) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={`Units: ${l}`}
              accessibilityState={{ selected: scale === s, disabled: locked }}
              disabled={locked}
              onPress={() => onScale(s)}
              style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: scale === s ? t.c.ink : t.c.surface, borderWidth: 1, borderColor: t.c.line }}
            >
              <Text style={{ color: scale === s ? t.c.bg : t.c.ink, fontWeight: '700' }}>{l}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {KEYS.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityLabel={k === 'del' ? 'Delete' : k === '.' ? 'Decimal point' : k}
            accessibilityState={{ disabled: locked }}
            disabled={locked}
            onPress={() => press(k)}
            style={({ pressed }) => ({
              width: '31.5%',
              height: 50,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? t.c.surfaceAlt : t.c.surface,
              borderWidth: 1,
              borderColor: t.c.line,
              borderBottomWidth: 3,
            })}
          >
            {k === 'del' ? <Icon name="backspace" color={t.c.ink} /> : <Text style={{ fontSize: 22, fontWeight: '700', color: t.c.ink }}>{k}</Text>}
          </Pressable>
        ))}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Toggle negative" disabled={locked} onPress={toggleSign} style={{ alignSelf: 'center', padding: 6 }}>
        <Text style={{ color: t.c.inkSoft, fontWeight: '700' }}>± negative</Text>
      </Pressable>
    </View>
  );
}
