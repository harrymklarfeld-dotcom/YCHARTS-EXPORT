import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { CompareChart } from '../components/CompareChart';
import { Body, Card, Chip, Disclaimer, Eyebrow, Title } from '../components/ui';
import { getCompanies } from '../data';
import { buildSeries, COMPARE_METRICS, MAX_COMPARE, metricKind, type CompareMode } from '../funds/compare';
import type { HistoryKey } from '../types/contract';
import { useTheme } from '../theme';

const MODES: { key: CompareMode; label: string; help: string }[] = [
  { key: 'raw', label: 'Raw', help: 'The numbers as reported each fiscal year.' },
  { key: 'indexed', label: 'Indexed to 100', help: 'Each line starts at 100, so you compare growth, not size. 150 means 50% bigger than the first year.' },
  { key: 'yoy', label: 'YoY growth', help: 'Change from the year before. Margins show the change in percentage points.' },
];

export default function CompareScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ tickers?: string; metric?: string }>();
  const companies = getCompanies();
  const initial = useMemo(() => {
    const fromParam = String(params.tickers ?? '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => companies.some((c) => c.ticker === s));
    const fill = ['MU', 'NVDA', 'AAPL', ...companies.map((c) => c.ticker)].filter((s) => companies.some((c) => c.ticker === s));
    const out = [...new Set([...fromParam, ...fill])].slice(0, fromParam.length ? Math.max(fromParam.length, 2) : 3);
    return out.slice(0, MAX_COMPARE);
  }, [params.tickers, companies]);
  const [picked, setPicked] = useState<string[]>(initial);
  const [metric, setMetric] = useState<HistoryKey>(
    COMPARE_METRICS.some((m) => m.key === params.metric) ? (params.metric as HistoryKey) : 'revenue',
  );
  const [mode, setMode] = useState<CompareMode>('indexed');
  const [notice, setNotice] = useState<string | null>(null);

  const series = useMemo(() => buildSeries(companies, picked, metric, mode), [companies, picked, metric, mode]);
  const metricLabel = COMPARE_METRICS.find((m) => m.key === metric)?.label ?? metric;
  const modeLabel = MODES.find((m) => m.key === mode)!;
  const chartW = Math.min(width, 520) - 32 - 32;

  const toggle = (tk: string) => {
    setNotice(null);
    setPicked((cur) => {
      if (cur.includes(tk)) return cur.filter((x) => x !== tk);
      if (cur.length >= MAX_COMPARE) {
        setNotice(`Up to ${MAX_COMPARE} at a time. Tap a selected company to remove it first.`);
        return cur;
      }
      return [...cur, tk];
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <Stack.Screen options={{ title: 'Compare', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        <View style={{ gap: 4 }}>
          <Title>Compare companies</Title>
          <Body soft size={14}>Put up to three businesses on one chart and watch how they grew.</Body>
        </View>

        <View style={{ gap: 8 }}>
          <Eyebrow>Companies · {picked.length}/{MAX_COMPARE}</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {companies.map((c) => (
              <Chip
                key={c.ticker}
                label={c.ticker}
                selected={picked.includes(c.ticker)}
                accessibilityLabel={`${c.name}${picked.includes(c.ticker) ? ', selected' : ''}`}
                onPress={() => toggle(c.ticker)}
              />
            ))}
          </View>
          {notice && <Text accessibilityLiveRegion="polite" style={{ color: t.c.danger, fontSize: 12, fontWeight: '700' }}>{notice}</Text>}
        </View>

        <View style={{ gap: 8 }}>
          <Eyebrow>Metric</Eyebrow>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {COMPARE_METRICS.map((m) => (
              <Chip key={m.key} label={m.label} selected={metric === m.key} onPress={() => setMetric(m.key)} />
            ))}
          </ScrollView>
        </View>

        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: t.c.surfaceAlt, borderRadius: t.radius.md, padding: 3 }}>
          {MODES.map((m) => {
            const on = m.key === mode;
            return (
              <Text
                key={m.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setMode(m.key)}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  paddingVertical: 9,
                  borderRadius: t.radius.md - 3,
                  overflow: 'hidden',
                  backgroundColor: on ? t.c.surface : 'transparent',
                  color: on ? t.c.ink : t.c.inkSoft,
                  fontWeight: '800',
                  fontSize: 13,
                }}
              >
                {m.label}
              </Text>
            );
          })}
        </View>

        <Card style={{ gap: 10 }}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 16 }}>
              {metricLabel} · {modeLabel.label}
            </Text>
            <Body soft size={12}>{modeLabel.help}</Body>
          </View>
          <CompareChart series={series} mode={mode} kind={metricKind(metric)} title={`${metricLabel}, ${modeLabel.label}`} width={chartW} />
        </Card>
        <Body soft size={12}>Annual figures from each company’s 10-K filings (fiscal years differ by company).</Body>
        <Disclaimer compact />
      </ScrollView>
    </View>
  );
}
