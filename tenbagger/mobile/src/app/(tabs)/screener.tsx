import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { MetricExplainer } from '../../components/MetricExplainer';
import { MetricPicker } from '../../components/MetricPicker';
import { Body, Chip, Disclaimer, Eyebrow, Title } from '../../components/ui';
import { dataInfo, getCompanies } from '../../data';
import {
  concentrationFor,
  funnelFor,
  mergeFilters,
  PRESET_SCREENS,
  runScreen,
  scoresFor,
  SIZE_BUCKETS,
  STYLE_BUCKETS,
  styleBoxesFor,
  toCsvFor,
  type FunnelOutput,
  type ScoreFamilyId,
  type SizeBucket,
  type StyleBucket,
} from '../../lib/screener';
import type { AssistAnswer } from '../../screener/assist';
import { csvColumns, getColumn, sortByColumn, type ColumnContext } from '../../screener/columns';
import type { SavedScreen, SortSpec, Watchlist } from '../../screener/lists';
import { shareCsv } from '../../screener/share';
import { useScreenerPrefs } from '../../screener/store';
import { AskBox } from '../../screener/components/AskBox';
import { ColumnsSheet } from '../../screener/components/ColumnsSheet';
import { ConcentrationCallout } from '../../screener/components/ConcentrationCallout';
import { FilterChips } from '../../screener/components/FilterChips';
import { FilterEditor } from '../../screener/components/FilterEditor';
import { FunnelBar } from '../../screener/components/FunnelBar';
import { ResultCards, ResultsTableBody, ResultsTableHeader } from '../../screener/components/Results';
import { SavedSheet } from '../../screener/components/SavedSheet';
import { ScoreSheet } from '../../screener/components/ScoreSheet';
import type { Company, Filter, Screen } from '../../types/contract';
import { useTheme } from '../../theme';

type Mode = 'presets' | 'custom' | 'watchlist';
const WIDE = 760;

export default function ScreenerScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const companies = getCompanies();
  const columns = useScreenerPrefs((s) => s.columns);
  const saveScreenPref = useScreenerPrefs((s) => s.saveScreen);

  const [mode, setMode] = useState<Mode>('presets');
  const [presetId, setPresetId] = useState(PRESET_SCREENS[0].id);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);
  const [explain, setExplain] = useState<string | null>(null);
  const [sortOverride, setSortOverride] = useState<SortSpec | null>(null);
  const [sizes, setSizes] = useState<SizeBucket[]>([]);
  const [styles, setStyles] = useState<StyleBucket[]>([]);
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [sheet, setSheet] = useState<null | 'columns' | 'saved'>(null);
  const [scoreFocus, setScoreFocus] = useState<{ ticker?: string; family?: ScoreFamilyId } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Scores and style buckets are relative to the whole universe, not the result list.
  const ctx: ColumnContext = useMemo(() => ({ scores: scoresFor(companies), styles: styleBoxesFor(companies) }), [companies]);

  const preset = PRESET_SCREENS.find((p) => p.id === presetId) ?? PRESET_SCREENS[0];
  const activeFilters: Filter[] = mode === 'presets' ? preset.filters : mode === 'custom' ? filters : [];
  const universe: Company[] = useMemo(
    () => (mode === 'watchlist' && watchlist ? companies.filter((c) => watchlist.tickers.includes(c.ticker)) : companies),
    [mode, watchlist, companies],
  );
  const screen: Screen = useMemo(() => ({ id: mode, name: mode, description: '', filters: activeFilters }), [mode, activeFilters]);

  const funnel: FunnelOutput | null = useMemo(() => {
    try {
      return funnelFor(universe, screen);
    } catch {
      return null;
    }
  }, [universe, screen]);
  const matched = useMemo(() => {
    try {
      return runScreen(universe, screen);
    } catch {
      return [];
    }
  }, [universe, screen]);
  const bucketed = useMemo(
    () =>
      matched.filter((c) => {
        const s = ctx.styles.get(c.ticker);
        if (sizes.length && (!s?.size || !sizes.includes(s.size))) return false;
        if (styles.length && (!s?.style || !styles.includes(s.style))) return false;
        return true;
      }),
    [matched, sizes, styles, ctx],
  );

  const defaultSort: SortSpec =
    mode === 'presets' && preset.sort
      ? { column: preset.sort.metric, dir: preset.sort.dir }
      : activeFilters[0]
        ? { column: activeFilters[0].metric, dir: getColumn(activeFilters[0].metric)?.defaultDir ?? 'desc' }
        : { column: 'score:quality', dir: 'desc' };
  const sort = sortOverride ?? defaultSort;
  const results = useMemo(() => sortByColumn(bucketed, sort.column, sort.dir, ctx), [bucketed, sort.column, sort.dir, ctx]);
  const conc = useMemo(() => concentrationFor(results), [results]);

  const onSort = (id: string) =>
    setSortOverride(sort.column === id ? { column: id, dir: sort.dir === 'desc' ? 'asc' : 'desc' } : { column: id, dir: getColumn(id)?.defaultDir ?? 'desc' });

  const applyAnswer = (a: AssistAnswer, how: 'replace' | 'append') => {
    const base = how === 'append' ? activeFilters : [];
    setFilters(mergeFilters(base as never, a.filters) as unknown as Filter[]);
    setMode('custom');
    setEditing(null);
    setSortOverride(null);
  };

  const exportCsv = async () => {
    const note = `Tenbagger screener export. Values from company annual filings (SEC EDGAR)${dataInfo.isSample ? ', sample data' : ''}; scores are within-list percentiles for learning. Educational only.`;
    const csv = toCsvFor(results, csvColumns(columns, ctx), note);
    const r = await shareCsv(csv, 'tenbagger-screen.csv');
    setToast(r === 'downloaded' ? 'CSV downloaded (and copied if allowed).' : r === 'copied' ? 'CSV copied to the clipboard.' : r === 'shared' ? 'CSV shared.' : r === 'dismissed' ? null : 'Could not export on this device.');
  };

  const openSaved = (s: SavedScreen) => {
    setFilters(s.filters);
    setMode('custom');
    useScreenerPrefs.getState().setColumns(s.columns);
    setSortOverride(s.sort ?? null);
    setSheet(null);
  };
  const openWatchlist = (w: Watchlist) => {
    setWatchlist(w);
    setMode('watchlist');
    setSortOverride(null);
    setSheet(null);
  };

  const pageW: ViewStyle = { width: '100%', maxWidth: 1180, alignSelf: 'center' };
  const scoreCompany = scoreFocus?.ticker ? companies.find((c) => c.ticker === scoreFocus.ticker) : undefined;

  const filtersBlock = (
    <View style={{ gap: 12 }}>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: t.c.surfaceAlt, borderRadius: 12, padding: 4 }}>
        {(
          [
            ['presets', 'Presets'],
            ['custom', 'My filters'],
            ...(watchlist ? ([['watchlist', watchlist.name]] as const) : []),
          ] as Array<[Mode, string]>
        ).map(([m, label]) => (
          <Pressable
            key={m}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m }}
            accessibilityLabel={label}
            onPress={() => {
              if (m === 'custom' && mode === 'presets' && filters.length === 0) setFilters(preset.filters.map((f) => ({ ...f })) as Filter[]);
              setMode(m);
              setSortOverride(null);
              setEditing(null);
            }}
            style={{ flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: mode === m ? t.c.surface : 'transparent', alignItems: 'center' }}
          >
            <Text numberOfLines={1} style={{ fontWeight: '800', color: mode === m ? t.c.ink : t.c.inkSoft }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'presets' ? (
        <View style={{ gap: 10 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {PRESET_SCREENS.map((p) => (
              <Chip key={p.id} label={p.name} selected={p.id === presetId} onPress={() => { setPresetId(p.id); setSortOverride(null); }} />
            ))}
          </ScrollView>
          <Body soft size={14}>{preset.description}</Body>
          {preset.caveat ? <Body soft size={12}>What it can miss: {preset.caveat}</Body> : null}
          <FilterChips filters={preset.filters} funnel={funnel} onExplain={setExplain} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy this preset into My filters to edit it"
            onPress={() => {
              setFilters(preset.filters.map((f) => ({ ...f })) as Filter[]);
              setMode('custom');
              setSortOverride(null);
            }}
          >
            <Text style={{ color: t.c.primary, fontWeight: '800' }}>Customize this preset →</Text>
          </Pressable>
        </View>
      ) : mode === 'custom' ? (
        <View style={{ gap: 10 }}>
          {filters.length === 0 ? <Body soft size={14}>No filters yet. Describe what you want above, or add one.</Body> : null}
          <FilterChips
            filters={filters}
            funnel={funnel}
            onEdit={(i) => setEditing(editing === i ? null : i)}
            onRemove={(i) => {
              setFilters((fs) => fs.filter((_, j) => j !== i));
              setEditing(null);
            }}
          />
          {editing !== null && filters[editing] ? (
            <FilterEditor
              filter={filters[editing]}
              onChange={(f) => setFilters((fs) => fs.map((x, j) => (j === editing ? f : x)))}
              onPickMetric={() => setPicker(true)}
              onExplain={setExplain}
              onDone={() => setEditing(null)}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add filter"
            onPress={() => {
              setFilters((fs) => [...fs, { metric: 'pe', op: '<', value: 25 }]);
              setEditing(filters.length);
            }}
            style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: t.radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.c.primary }}
          >
            <Icon name="plus" color={t.c.primary} size={18} />
            <Text style={{ color: t.c.primary, fontWeight: '800' }}>Add filter</Text>
          </Pressable>
        </View>
      ) : (
        <Body soft size={14}>Watchlist “{watchlist?.name}”: {watchlist?.tickers.length ?? 0} companies you saved on this device.</Body>
      )}

      <View style={{ gap: 6 }}>
        <Eyebrow>Size & style buckets</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {SIZE_BUCKETS.map((b) => (
            <Chip key={b} label={b} selected={sizes.includes(b)} accessibilityLabel={`Size ${b}`} onPress={() => setSizes((xs) => (xs.includes(b) ? xs.filter((x) => x !== b) : [...xs, b]))} style={{ paddingVertical: 6 }} />
          ))}
          <View style={{ width: 8 }} />
          {STYLE_BUCKETS.map((b) => (
            <Chip key={b} label={b} selected={styles.includes(b)} accessibilityLabel={`Style ${b}`} onPress={() => setStyles((xs) => (xs.includes(b) ? xs.filter((x) => x !== b) : [...xs, b]))} style={{ paddingVertical: 6 }} />
          ))}
        </View>
      </View>

      {funnel && funnel.steps.length ? (
        <View style={{ backgroundColor: t.c.surface, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.c.line, padding: 12, gap: 8 }}>
          <Eyebrow>Filter funnel</Eyebrow>
          <FunnelBar funnel={funnel} extra={sizes.length || styles.length ? { label: 'Size & style', after: results.length } : undefined} />
        </View>
      ) : null}
    </View>
  );

  const toolbar = (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Eyebrow>
          {results.length} match{results.length === 1 ? '' : 'es'} of {universe.length}
        </Eyebrow>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <ToolButton label="Columns" icon="sort" onPress={() => setSheet('columns')} />
          <ToolButton label="Saved" icon="star" onPress={() => setSheet('saved')} />
          <ToolButton label="Export CSV" icon="link" onPress={exportCsv} disabled={!results.length} />
        </View>
      </View>
      {!wide ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>Sort:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {Array.from(new Set([...columns, sort.column])).map((id) => (
              <Chip
                key={id}
                label={`${getColumn(id)?.short ?? id}${sort.column === id ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}`}
                selected={sort.column === id}
                accessibilityLabel={`Sort by ${getColumn(id)?.label ?? id}`}
                onPress={() => onSort(id)}
                style={{ paddingVertical: 6 }}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel="How are the scores calculated?" onPress={() => setScoreFocus({})} hitSlop={6}>
        <Text style={{ color: t.c.primary, fontWeight: '700', fontSize: 13 }}>
          Scores are 0–100 percentiles within these {companies.length} companies, not ratings. How is this calculated?
        </Text>
      </Pressable>
      {toast ? <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{toast}</Text> : null}
      <ConcentrationCallout out={conc} />
    </View>
  );

  const empty =
    results.length === 0 ? (
      <View style={{ padding: 24, alignItems: 'center', gap: 6 }}>
        <Text style={{ fontFamily: t.fonts.display, fontSize: 18, color: t.c.ink }}>Nothing matches — yet.</Text>
        <Body soft size={14} style={{ textAlign: 'center' }}>
          {funnel?.biggestCut ? `“${funnel.biggestCut.label}” removed the most. Try loosening it.` : 'Loosen a filter. Strict screens are a lesson too: great numbers are rare.'}
        </Body>
      </View>
    ) : null;

  const top = (
    <View style={[pageW, { gap: 16, paddingBottom: 12 }]}>
      <View style={{ gap: 4 }}>
        <Title>Screener</Title>
        <Body soft size={14}>
          Filter {companies.length} companies by what their filings say{dataInfo.isSample ? ' · sample data' : ''}.
        </Body>
      </View>
      {wide ? (
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <AskBox hasFilters={activeFilters.length > 0} onApply={applyAnswer} />
          </View>
          <View style={{ flex: 1.2 }}>{filtersBlock}</View>
        </View>
      ) : (
        <>
          <AskBox hasFilters={activeFilters.length > 0} onApply={applyAnswer} />
          {filtersBlock}
        </>
      )}
      {toolbar}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={wide && results.length ? [1] : undefined}
      >
        {top}
        {wide && results.length ? (
          <View style={[pageW, { backgroundColor: t.c.bg }]}>
            <ResultsTableHeader columns={columns} sort={sort} onSort={onSort} />
          </View>
        ) : (
          <View />
        )}
        <View style={pageW}>
          {wide ? (
            results.length ? (
              <ResultsTableBody companies={results} columns={columns} ctx={ctx} onScore={(ticker, family) => setScoreFocus({ ticker, family: family as ScoreFamilyId })} />
            ) : null
          ) : (
            <ResultCards companies={results} columns={columns} ctx={ctx} onScore={(ticker, family) => setScoreFocus({ ticker, family: family as ScoreFamilyId })} />
          )}
          {empty}
        </View>
        <View style={[pageW, { marginTop: 16 }]}>
          <Disclaimer compact />
        </View>
      </ScrollView>

      <MetricPicker
        visible={picker}
        title="Choose a metric"
        onClose={() => setPicker(false)}
        onExplain={(k) => {
          setPicker(false);
          setExplain(k);
        }}
        onPick={(k) => {
          if (editing !== null) setFilters((fs) => fs.map((f, j) => (j === editing ? ({ ...f, metric: k } as Filter) : f)));
          setPicker(false);
        }}
      />
      <MetricExplainer metric={explain} onClose={() => setExplain(null)} />
      <ColumnsSheet visible={sheet === 'columns'} onClose={() => setSheet(null)} />
      <SavedSheet
        visible={sheet === 'saved'}
        onClose={() => setSheet(null)}
        canSaveScreen={activeFilters.length > 0}
        resultTickers={results.map((c) => c.ticker)}
        onSaveScreen={(name) => saveScreenPref({ name: name || (mode === 'presets' ? preset.name : ''), filters: activeFilters, columns, sort })}
        onOpenScreen={openSaved}
        onOpenWatchlist={openWatchlist}
      />
      <ScoreSheet
        visible={scoreFocus !== null}
        onClose={() => setScoreFocus(null)}
        universeSize={companies.length}
        focus={scoreFocus?.family ?? null}
        company={scoreCompany ? { ticker: scoreCompany.ticker, name: scoreCompany.name, scores: ctx.scores.get(scoreCompany.ticker)! } : null}
      />
    </SafeAreaView>
  );
}

function ToolButton({ label, icon, onPress, disabled }: { label: string; icon: 'sort' | 'star' | 'link'; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: t.c.line, backgroundColor: t.c.surface, opacity: disabled ? 0.5 : 1 }}
    >
      <Icon name={icon} color={t.c.ink} size={15} />
      <Text style={{ color: t.c.ink, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
