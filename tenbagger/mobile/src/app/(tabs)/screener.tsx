import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompanyRow } from '../../components/CompanyRow';
import { Icon } from '../../components/Icon';
import { MetricExplainer } from '../../components/MetricExplainer';
import { MetricPicker } from '../../components/MetricPicker';
import { Body, Chip, Disclaimer, Eyebrow, Title } from '../../components/ui';
import { dataInfo, getCompanies } from '../../data';
import { inputUnitFor, METRIC_BY_KEY } from '../../lib/metricCatalog';
import { describeFilter, PRESET_SCREENS, runScreen, sortCompanies } from '../../lib/screener';
import type { Filter, FilterOp, Screen } from '../../types/contract';
import { useTheme } from '../../theme';

const OPS: FilterOp[] = ['>=', '<=', 'between'];
const OP_LABEL: Record<string, string> = { '>=': 'at least', '<=': 'at most', between: 'between', '>': 'above', '<': 'below', '==': 'equals' };

type Draft = { metric: string; op: FilterOp; a: string; b: string };

function draftToFilter(d: Draft): Filter | null {
  const u = inputUnitFor(d.metric);
  const a = Number(d.a);
  if (d.a.trim() === '' || !Number.isFinite(a)) return null;
  if (d.op === 'between') {
    const b = Number(d.b);
    if (d.b.trim() === '' || !Number.isFinite(b)) return null;
    return { metric: d.metric as Filter['metric'], op: 'between', value: [u.toRaw(a), u.toRaw(b)] };
  }
  return { metric: d.metric as Filter['metric'], op: d.op, value: u.toRaw(a) };
}

export default function ScreenerScreen() {
  const t = useTheme();
  const companies = getCompanies();
  const [mode, setMode] = useState<'presets' | 'custom'>('presets');
  const [presetId, setPresetId] = useState(PRESET_SCREENS[0].id);
  const [drafts, setDrafts] = useState<Draft[]>([{ metric: 'gross_margin', op: '>=', a: '40', b: '' }]);
  const [pickerFor, setPickerFor] = useState<number | 'sort' | null>(null);
  const [explain, setExplain] = useState<string | null>(null);
  const [sortOverride, setSortOverride] = useState<{ metric: string; dir: 'asc' | 'desc' } | null>(null);

  const preset = PRESET_SCREENS.find((p) => p.id === presetId) ?? PRESET_SCREENS[0];
  const customScreen: Screen = useMemo(
    () => ({
      id: 'custom',
      name: 'My screen',
      description: '',
      filters: drafts.map(draftToFilter).filter((f): f is Filter => f !== null),
    }),
    [drafts],
  );
  const active = mode === 'presets' ? preset : customScreen;
  const sort = sortOverride ?? active.sort ?? { metric: active.filters[0]?.metric ?? 'market_cap', dir: 'desc' as const };
  const results = useMemo(() => sortCompanies(runScreen(companies, active), sort.metric, sort.dir), [companies, active, sort.metric, sort.dir]);
  const shownMetrics = Array.from(new Set([sort.metric, ...active.filters.map((f) => f.metric as string)]));

  const updateDraft = (i: number, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4 }}>
          <Title>Screener</Title>
          <Body soft size={14}>
            Filter {companies.length} companies by what their filings say{dataInfo.isSample ? ' · sample data' : ''}.
          </Body>
        </View>

        <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: t.c.surfaceAlt, borderRadius: 12, padding: 4 }}>
          {(['presets', 'custom'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
              accessibilityLabel={m === 'presets' ? 'Preset screens' : 'Build your own screen'}
              onPress={() => {
                setMode(m);
                setSortOverride(null);
              }}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 9, backgroundColor: mode === m ? t.c.surface : 'transparent', alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '800', color: mode === m ? t.c.ink : t.c.inkSoft }}>{m === 'presets' ? 'Presets' : 'Build your own'}</Text>
            </Pressable>
          ))}
        </View>

        {mode === 'presets' ? (
          <View style={{ gap: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {PRESET_SCREENS.map((p) => (
                <Chip key={p.id} label={p.name} selected={p.id === presetId} onPress={() => { setPresetId(p.id); setSortOverride(null); }} />
              ))}
            </ScrollView>
            <View style={{ backgroundColor: t.c.surface, borderRadius: t.radius.lg, padding: 16, gap: 10, borderWidth: 1, borderColor: t.c.line }}>
              <Text style={{ fontFamily: t.fonts.display, fontSize: 20, fontWeight: '700', color: t.c.ink }}>{preset.name}</Text>
              <Body soft size={14}>{preset.description}</Body>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {preset.filters.map((f, i) => (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityLabel={`${describeFilter(f)}. Tap to learn what ${METRIC_BY_KEY[f.metric]?.label ?? f.metric} means`}
                    onPress={() => setExplain(f.metric)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.c.primarySoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}
                  >
                    <Text style={{ color: t.c.ink, fontWeight: '700', fontSize: 13 }}>{describeFilter(f)}</Text>
                    <Icon name="info" color={t.c.primary} size={15} />
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {drafts.map((d, i) => {
              const info = METRIC_BY_KEY[d.metric];
              const u = inputUnitFor(d.metric);
              return (
                <View key={i} style={{ backgroundColor: t.c.surface, borderRadius: t.radius.md, padding: 12, gap: 10, borderWidth: 1, borderColor: t.c.line }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Metric: ${info?.label ?? d.metric}. Change metric`}
                      onPress={() => setPickerFor(i)}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.c.surfaceAlt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}
                    >
                      <Text style={{ color: t.c.ink, fontWeight: '800' }}>{info?.label ?? d.metric}</Text>
                      <Icon name="chevron" color={t.c.inkSoft} size={16} />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`What is ${info?.label}?`} onPress={() => setExplain(d.metric)} hitSlop={8}>
                      <Icon name="info" color={t.c.inkSoft} />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Remove filter" onPress={() => setDrafts((ds) => ds.filter((_, j) => j !== i))} hitSlop={8}>
                      <Icon name="trash" color={t.c.danger} />
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {OPS.map((op) => (
                      <Chip key={op} label={OP_LABEL[op]} selected={d.op === op} onPress={() => updateDraft(i, { op })} accessibilityLabel={`Operator ${OP_LABEL[op]}`} />
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {[d.a, ...(d.op === 'between' ? [d.b] : [])].map((val, k) => (
                      <View key={k} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: t.c.line, borderRadius: 10, paddingHorizontal: 10 }}>
                        {u.prefix ? <Text style={{ color: t.c.inkSoft, fontWeight: '700' }}>{u.prefix}</Text> : null}
                        <TextInput
                          accessibilityLabel={k === 0 ? (d.op === 'between' ? 'Minimum value' : 'Value') : 'Maximum value'}
                          value={val}
                          onChangeText={(s) => updateDraft(i, k === 0 ? { a: s } : { b: s })}
                          keyboardType="numbers-and-punctuation"
                          placeholder={k === 0 ? '0' : 'max'}
                          placeholderTextColor={t.c.locked}
                          style={{ flex: 1, paddingVertical: 10, color: t.c.ink, fontSize: 16, fontWeight: '700' }}
                        />
                        <Text style={{ color: t.c.inkSoft, fontWeight: '700' }}>{u.suffix}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add filter"
              onPress={() => setDrafts((ds) => [...ds, { metric: 'pe', op: '<=', a: '25', b: '' }])}
              style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: t.radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.c.primary }}
            >
              <Icon name="plus" color={t.c.primary} />
              <Text style={{ color: t.c.primary, fontWeight: '800' }}>Add filter</Text>
            </Pressable>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Eyebrow>{results.length} match{results.length === 1 ? '' : 'es'}</Eyebrow>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Sort by ${METRIC_BY_KEY[sort.metric]?.label ?? sort.metric}. Change sort metric`} onPress={() => setPickerFor('sort')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>Sort:</Text>
              <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 13 }}>{METRIC_BY_KEY[sort.metric]?.short ?? sort.metric}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={sort.dir === 'desc' ? 'Sorted high to low. Switch to low to high' : 'Sorted low to high. Switch to high to low'}
              onPress={() => setSortOverride({ metric: sort.metric, dir: sort.dir === 'desc' ? 'asc' : 'desc' })}
              style={{ padding: 6, borderRadius: 8, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.line }}
            >
              <Icon name={sort.dir === 'desc' ? 'arrowDown' : 'arrowUp'} color={t.c.ink} size={16} />
            </Pressable>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          {results.map((c) => (
            <CompanyRow key={c.ticker} company={c} metrics={shownMetrics} />
          ))}
          {results.length === 0 && (
            <View style={{ padding: 24, alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: t.fonts.display, fontSize: 18, color: t.c.ink }}>Nothing matches — yet.</Text>
              <Body soft size={14} style={{ textAlign: 'center' }}>Loosen a filter. Strict screens are a lesson too: great numbers are rare.</Body>
            </View>
          )}
        </View>
        <Disclaimer compact />
      </ScrollView>

      <MetricPicker
        visible={pickerFor !== null}
        title={pickerFor === 'sort' ? 'Sort by' : 'Choose a metric'}
        onClose={() => setPickerFor(null)}
        onExplain={(k) => {
          setPickerFor(null);
          setExplain(k);
        }}
        onPick={(k) => {
          if (pickerFor === 'sort') setSortOverride({ metric: k, dir: sort.dir });
          else if (typeof pickerFor === 'number') updateDraft(pickerFor, { metric: k });
          setPickerFor(null);
        }}
      />
      <MetricExplainer metric={explain} onClose={() => setExplain(null)} />
    </SafeAreaView>
  );
}
