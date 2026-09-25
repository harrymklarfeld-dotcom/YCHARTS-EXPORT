import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TickerBadge } from '../../components/CompanyRow';
import { Icon } from '../../components/Icon';
import { MetricExplainer } from '../../components/MetricExplainer';
import { MiniBarChart } from '../../components/MiniBarChart';
import { Body, Button, Disclaimer, Eyebrow, Title } from '../../components/ui';
import { getCompany, getUnits } from '../../data';
import { formatPercent, formatUsdCompact, formatValue } from '../../lib/format';
import { METRIC_BY_KEY, metricCue, type Cue } from '../../lib/metricCatalog';
import { practiceLessonFor } from '../../lib/practice';
import { getMetricValue } from '../../lib/screener';
import type { HistoryKey } from '../../types/contract';
import { useTheme } from '../../theme';

const GRID: { title: string; keys: string[] }[] = [
  { title: 'Valuation', keys: ['market_cap', 'pe', 'ps', 'ev_ebitda', 'fcf_yield', 'dividend_yield'] },
  { title: 'Profitability', keys: ['gross_margin', 'operating_margin', 'net_margin', 'roic', 'roe', 'fcf_margin'] },
  { title: 'Health & growth', keys: ['net_cash', 'debt_to_equity', 'current_ratio', 'revenue_growth_yoy', 'revenue_cagr_3y', 'eps_growth_yoy'] },
];

const CHARTS: { key: HistoryKey; title: string; fmt: (v: number | null) => string }[] = [
  { key: 'revenue', title: 'Revenue', fmt: (v) => formatUsdCompact(v) },
  { key: 'net_income', title: 'Net income', fmt: (v) => formatUsdCompact(v) },
  { key: 'free_cash_flow', title: 'Free cash flow', fmt: (v) => formatUsdCompact(v) },
  { key: 'eps_diluted', title: 'EPS (diluted)', fmt: (v) => (v === null ? '—' : `$${v.toFixed(2)}`) },
  { key: 'gross_margin', title: 'Gross margin', fmt: (v) => formatPercent(v) },
  { key: 'operating_margin', title: 'Operating margin', fmt: (v) => formatPercent(v) },
];

/** Neutral, descriptive words: "High"/"Low" vs. a rule-of-thumb range. Colour carries the cue. */
function cueWord(key: string, cue: Cue): string {
  if (cue === 'none') return '';
  if (cue === 'neutral') return 'Typical range';
  const higherIsStrong = METRIC_BY_KEY[key]?.better === 'higher';
  const high = cue === 'strong' ? higherIsStrong : !higherIsStrong;
  return high ? 'High vs. typical' : 'Low vs. typical';
}

export default function CompanyScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [explain, setExplain] = useState<string | null>(null);
  const c = ticker ? getCompany(String(ticker)) : undefined;
  const practiceCount = useMemo(() => (c ? practiceLessonFor(c, getUnits()).questions.length : 0), [c]);

  if (!c) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg, padding: 24 }}>
        <Title>Company not found</Title>
      </View>
    );
  }
  const cueColor: Record<Cue, string> = { strong: t.c.primary, caution: t.c.danger, neutral: t.c.accent, none: t.c.line };
  const contentW = Math.min(width, 520) - 32;
  const tileW = (contentW - 10) / 2;
  const chartW = tileW - 24;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <Stack.Screen options={{ title: c.ticker }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <TickerBadge ticker={c.ticker} size={60} />
          <View style={{ flex: 1, gap: 2 }}>
            <Title size={24}>{c.name}</Title>
            <Body soft size={13}>
              {c.sector} · {c.industry}
            </Body>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 30, fontWeight: '800', color: t.c.ink, fontVariant: ['tabular-nums'] }}>{c.price === null ? '—' : `$${c.price.toFixed(2)}`}</Text>
          <View style={{ backgroundColor: c.price_is_sample ? t.c.accentSoft : t.c.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: t.c.ink, fontSize: 11, fontWeight: '700' }}>
              {c.price_is_sample ? 'Sample price' : 'Price'} · {c.price_date}
            </Text>
          </View>
          <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>Fundamentals FY{c.latest_fy}</Text>
        </View>

        {GRID.map((g) => (
          <View key={g.title} style={{ gap: 8 }}>
            <Eyebrow>{g.title}</Eyebrow>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {g.keys.map((k) => {
                const info = METRIC_BY_KEY[k];
                const v = getMetricValue(c, k);
                const cue = metricCue(k, v);
                return (
                  <Pressable
                    key={k}
                    accessibilityRole="button"
                    accessibilityLabel={`${info.label}: ${formatValue(v, info.format)}${cue !== 'none' ? `, ${cueWord(k, cue)}` : ''}. Tap for explanation`}
                    onPress={() => setExplain(k)}
                    style={{ width: tileW, backgroundColor: t.c.surface, borderRadius: t.radius.md, padding: 12, gap: 4, borderWidth: 1, borderColor: t.c.line, minHeight: 92 }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '700' }}>{info.label}</Text>
                      <Icon name="info" color={t.c.locked} size={14} />
                    </View>
                    <Text style={{ color: t.c.ink, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{formatValue(v, info.format)}</Text>
                    {cue !== 'none' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cueColor[cue] }} />
                        <Text style={{ color: cueColor[cue], fontSize: 11, fontWeight: '800' }}>{cueWord(k, cue)}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <Body soft size={12}>Colour cues are rules of thumb for learning, not ratings. Tap any number for a plain-English explanation.</Body>

        <View style={{ gap: 8 }}>
          <Eyebrow>History</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {CHARTS.filter((ch) => (c.history[ch.key]?.length ?? 0) > 0).map((ch) => (
              <View key={ch.key} style={{ width: tileW, backgroundColor: t.c.surface, borderRadius: t.radius.md, padding: 12, borderWidth: 1, borderColor: t.c.line }}>
                <MiniBarChart data={c.history[ch.key] ?? []} title={ch.title} format={ch.fmt} width={chartW} height={56} />
              </View>
            ))}
          </View>
        </View>
        <Disclaimer compact />
      </ScrollView>
      <View style={{ padding: 16, paddingBottom: 16 + insets.bottom, borderTopWidth: 1, borderTopColor: t.c.line, backgroundColor: t.c.bg }}>
        <Button
          label={practiceCount ? `Practice with ${c.ticker} · ${practiceCount} questions` : 'No practice questions yet'}
          disabled={!practiceCount}
          onPress={() => router.push(`/practice/${c.ticker}`)}
        />
      </View>
      <MetricExplainer metric={explain} onClose={() => setExplain(null)} />
    </View>
  );
}
