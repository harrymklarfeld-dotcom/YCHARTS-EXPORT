import { Text, View } from 'react-native';
import { getCompany } from '../../data';
import { useTheme } from '../../theme';
import { getArticlesFile } from '../data';
import { provenanceTags } from '../provenance';
import { formatMetric, metricValue, workedFormula } from '../values';
import { Unsupported, WidgetFrame } from './WidgetFrame';

export function MetricWidget({ ticker, metric, caption }: { ticker: string; metric: string; caption?: string }) {
  const t = useTheme();
  const catalog = getArticlesFile().metrics;
  const c = getCompany(ticker);
  const info = catalog[metric];
  if (!c || !info) return <Unsupported reason={`no data for ${ticker} ${metric}`} />;
  const v = metricValue(c, metric, catalog);
  const { formula, worked } = workedFormula(c, metric, catalog);
  const tags = provenanceTags([c], [metric]);
  const shown = formatMetric(v, metric, catalog);
  return (
    <WidgetFrame
      eyebrow="Live number"
      caption={caption}
      sample={tags.sample}
      samplePrice={tags.samplePrice}
      real={`${c.ticker} FY${c.latest_fy} reported`}
      accessibilityLabel={`${c.name} ${info.label}, fiscal ${c.latest_fy}: ${shown}. ${formula}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.c.inkSoft, fontSize: 13, fontWeight: '700' }}>
            {c.name} · FY{c.latest_fy}
          </Text>
          <Text style={{ color: t.c.ink, fontSize: 16, fontWeight: '800' }}>{info.label}</Text>
        </View>
        <Text style={{ color: t.c.ink, fontFamily: t.fonts.display, fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.5 }}>{shown}</Text>
      </View>
      <View style={{ backgroundColor: t.c.surfaceAlt, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, gap: 2 }}>
        <Text style={{ color: t.c.inkSoft, fontSize: 13, fontFamily: t.fonts.mono }}>{formula}</Text>
        {worked ? <Text style={{ color: t.c.ink, fontSize: 13, fontWeight: '700', fontFamily: t.fonts.mono }}>= {worked}</Text> : null}
      </View>
    </WidgetFrame>
  );
}
