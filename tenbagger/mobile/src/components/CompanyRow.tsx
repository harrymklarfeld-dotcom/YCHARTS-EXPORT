import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { METRIC_BY_KEY, metricCue } from '../lib/metricCatalog';
import { formatValue } from '../lib/format';
import { getMetricValue } from '../lib/screener';
import type { Company } from '../types/contract';
import { useTheme } from '../theme';
import { Icon } from './Icon';

export function TickerBadge({ ticker, size = 44 }: { ticker: string; size?: number }) {
  const t = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: t.c.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t.c.bg, fontWeight: '900', fontSize: ticker.length > 3 ? size * 0.24 : size * 0.3, letterSpacing: 0.5 }}>{ticker}</Text>
    </View>
  );
}

export function CompanyRow({ company, metrics }: { company: Company; metrics: string[] }) {
  const t = useTheme();
  const cueColor = { strong: t.c.primary, caution: t.c.danger, neutral: t.c.ink, none: t.c.ink };
  const valuesText = metrics
    .map((k) => `${METRIC_BY_KEY[k]?.short ?? k} ${formatValue(getMetricValue(company, k), METRIC_BY_KEY[k]?.format ?? 'ratio')}`)
    .join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${company.name}, ${company.ticker}. ${valuesText}. Open company.`}
      onPress={() => router.push(`/company/${company.ticker}`)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        backgroundColor: pressed ? t.c.surfaceAlt : t.c.surface,
        borderRadius: t.radius.md,
        borderWidth: 1,
        borderColor: t.c.line,
      })}
    >
      <TickerBadge ticker={company.ticker} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: t.c.ink, fontWeight: '800', fontSize: 15 }}>{company.name}</Text>
        <Text numberOfLines={1} style={{ color: t.c.inkSoft, fontSize: 12 }}>{company.industry}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {metrics.slice(0, 2).map((k) => {
          const v = getMetricValue(company, k);
          const info = METRIC_BY_KEY[k];
          return (
            <Text key={k} style={{ fontSize: 12, color: t.c.inkSoft }}>
              {info?.short ?? k}{' '}
              <Text style={{ fontWeight: '800', fontSize: 14, color: cueColor[metricCue(k, v)], fontVariant: ['tabular-nums'] }}>
                {formatValue(v, info?.format ?? 'ratio')}
              </Text>
            </Text>
          );
        })}
      </View>
      <Icon name="chevron" color={t.c.inkSoft} size={18} />
    </Pressable>
  );
}
