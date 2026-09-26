import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { getCompany } from '../../data';
import { useTheme } from '../../theme';
import type { Company } from '../../types/contract';
import { getArticlesFile } from '../data';
import { isSampleFundamentals, provenanceTags } from '../provenance';
import { formatMetric, metricValue } from '../values';
import { Unsupported, WidgetFrame } from './WidgetFrame';

const LABEL_W = 52;
const VALUE_W = 70;
const BAR_H = 22;

/** Horizontal bars of one metric across companies; negatives extend left of a zero line. */
export function CompareWidget({ tickers, metric, caption }: { tickers: string[]; metric: string; caption?: string }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const catalog = getArticlesFile().metrics;
  const info = catalog[metric];
  const companies = tickers.map((x) => getCompany(x)).filter((c): c is Company => !!c);
  if (!info || companies.length < 2) return <Unsupported reason={`cannot compare ${metric}`} />;
  const rows = companies.map((c) => ({ c, v: metricValue(c, metric, catalog) }));
  const vals = rows.map((r) => r.v ?? 0);
  const max = Math.max(0, ...vals);
  const min = Math.min(0, ...vals);
  const span = max - min || 1;
  const barW = Math.max(0, w - LABEL_W - VALUE_W - 16);
  const zeroX = (-min / span) * barW;
  const tags = provenanceTags(companies, [metric]);
  const summary = rows.map((r) => `${r.c.ticker} ${formatMetric(r.v, metric, catalog)}`).join(', ');
  return (
    <WidgetFrame
      eyebrow="Compare"
      title={info.label}
      caption={caption}
      sample={tags.sample}
      samplePrice={tags.samplePrice}
      accessibilityLabel={`${info.label}: ${summary}`}
    >
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ gap: 8 }}>
        {rows.map(({ c, v }) => {
          const val = v ?? 0;
          const len = (Math.abs(val) / span) * barW;
          const x = val >= 0 ? zeroX : zeroX - len;
          const sample = isSampleFundamentals(c);
          return (
            <View key={c.ticker} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ width: LABEL_W, color: t.c.ink, fontWeight: '800', fontSize: 13, fontFamily: t.fonts.body }}>
                {c.ticker}
                {sample ? <Text style={{ color: t.c.accent }}>*</Text> : null}
              </Text>
              {barW > 0 ? (
                <Svg width={barW} height={BAR_H}>
                  <Rect x={0} y={0} width={barW} height={BAR_H} rx={6} fill={t.c.surfaceAlt} />
                  <Rect x={x} y={2} width={Math.max(2, len)} height={BAR_H - 4} rx={5} fill={val < 0 ? t.c.danger : sample ? t.c.accent : t.c.primary} opacity={v === null ? 0.25 : 1} />
                  {min < 0 && <Line x1={zeroX} x2={zeroX} y1={0} y2={BAR_H} stroke={t.c.inkSoft} strokeWidth={1} />}
                </Svg>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <Text style={{ width: VALUE_W, textAlign: 'right', color: t.c.ink, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] }}>{formatMetric(v, metric, catalog)}</Text>
            </View>
          );
        })}
      </View>
      <Text style={{ color: t.c.inkSoft, fontSize: 12, fontFamily: t.fonts.mono }}>
        {info.formula}
        {tags.sample ? '   * sample data' : ''}
      </Text>
    </WidgetFrame>
  );
}
