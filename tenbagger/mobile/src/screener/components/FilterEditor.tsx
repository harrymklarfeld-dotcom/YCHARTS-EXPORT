import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Chip } from '../../components/ui';
import { getEngineMetricInfo } from '../../lib/screener';
import type { Filter, FilterOp } from '../../types/contract';
import { useTheme } from '../../theme';

const OPS: FilterOp[] = ['>', '<', 'between'];
const OP_LABEL: Record<string, string> = { '>': 'above', '<': 'below', between: 'between', '>=': 'at least', '<=': 'at most', '==': 'equals' };

/** Typed units: percents as 15 (→ 0.15), dollars in $B, multiples as-is. */
export function unitFor(metric: string) {
  const u = getEngineMetricInfo(metric)?.unit;
  if (u === 'percent') return { prefix: '', suffix: '%', toRaw: (n: number) => n / 100, fromRaw: (n: number) => Math.round(n * 100 * 1000) / 1000 };
  if (u === 'usd') return { prefix: '$', suffix: 'B', toRaw: (n: number) => n * 1e9, fromRaw: (n: number) => Math.round((n / 1e9) * 1000) / 1000 };
  if (u === 'multiple') return { prefix: '', suffix: '×', toRaw: (n: number) => n, fromRaw: (n: number) => n };
  return { prefix: '', suffix: '', toRaw: (n: number) => n, fromRaw: (n: number) => n };
}

function toText(f: Filter): { a: string; b: string } {
  const u = unitFor(f.metric);
  if (Array.isArray(f.value)) return { a: String(u.fromRaw(f.value[0])), b: String(u.fromRaw(f.value[1])) };
  return { a: String(u.fromRaw(f.value)), b: '' };
}

/** Inline editor for one filter. Calls onChange only with valid filters. */
export function FilterEditor({
  filter,
  onChange,
  onPickMetric,
  onExplain,
  onDone,
}: {
  filter: Filter;
  onChange: (f: Filter) => void;
  onPickMetric: () => void;
  onExplain: (metric: string) => void;
  onDone: () => void;
}) {
  const t = useTheme();
  const info = getEngineMetricInfo(filter.metric);
  const u = unitFor(filter.metric);
  const [txt, setTxt] = useState(() => toText(filter));
  useEffect(() => setTxt(toText(filter)), [filter.metric]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (op: FilterOp, a: string, b: string) => {
    const na = Number(a);
    if (a.trim() === '' || !Number.isFinite(na)) return;
    if (op === 'between') {
      const nb = Number(b);
      if (b.trim() === '' || !Number.isFinite(nb)) return;
      const lo = Math.min(na, nb);
      const hi = Math.max(na, nb);
      onChange({ metric: filter.metric, op, value: [u.toRaw(lo), u.toRaw(hi)] });
    } else onChange({ metric: filter.metric, op, value: u.toRaw(na) });
  };

  const opShown: FilterOp = filter.op === '>=' ? '>' : filter.op === '<=' ? '<' : filter.op === '==' ? '>' : filter.op;
  return (
    <View style={{ backgroundColor: t.c.surface, borderRadius: t.radius.md, padding: 12, gap: 10, borderWidth: 1.5, borderColor: t.c.primary }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Metric: ${info?.label ?? filter.metric}. Change metric`}
          onPress={onPickMetric}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.c.surfaceAlt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}
        >
          <Text style={{ color: t.c.ink, fontWeight: '800' }}>{info?.label ?? filter.metric}</Text>
          <Icon name="chevron" color={t.c.inkSoft} size={16} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`What is ${info?.label}?`} onPress={() => onExplain(filter.metric)} hitSlop={8}>
          <Icon name="info" color={t.c.inkSoft} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {OPS.map((op) => (
          <Chip
            key={op}
            label={OP_LABEL[op]}
            selected={opShown === op}
            accessibilityLabel={`Operator ${OP_LABEL[op]}`}
            onPress={() => {
              const b = op === 'between' && !txt.b ? txt.a : txt.b;
              setTxt({ a: txt.a, b });
              commit(op, txt.a, b);
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {[txt.a, ...(filter.op === 'between' ? [txt.b] : [])].map((val, k) => (
          <View key={k} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: t.c.line, borderRadius: 10, paddingHorizontal: 10 }}>
            {u.prefix ? <Text style={{ color: t.c.inkSoft, fontWeight: '700' }}>{u.prefix}</Text> : null}
            <TextInput
              accessibilityLabel={k === 0 ? (filter.op === 'between' ? 'Minimum value' : 'Value') : 'Maximum value'}
              value={val}
              onChangeText={(s) => {
                const next = k === 0 ? { a: s, b: txt.b } : { a: txt.a, b: s };
                setTxt(next);
                commit(filter.op, next.a, next.b);
              }}
              keyboardType="numbers-and-punctuation"
              style={{ flex: 1, paddingVertical: 10, color: t.c.ink, fontSize: 16, fontWeight: '700' }}
            />
            <Text style={{ color: t.c.inkSoft, fontWeight: '700' }}>{u.suffix}</Text>
          </View>
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="Done editing" onPress={onDone} style={{ padding: 10, borderRadius: 10, backgroundColor: t.c.primary }}>
          <Icon name="check" color={t.c.primaryInk} size={18} />
        </Pressable>
      </View>
    </View>
  );
}
