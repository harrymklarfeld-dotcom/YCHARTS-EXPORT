import { Text, View } from 'react-native';
import { METRIC_BY_KEY } from '../lib/metricCatalog';
import { useTheme } from '../theme';
import { Sheet } from './Sheet';
import { Body, Eyebrow } from './ui';

export function MetricExplainer({ metric, onClose }: { metric: string | null; onClose: () => void }) {
  const t = useTheme();
  const info = metric ? METRIC_BY_KEY[metric] : undefined;
  return (
    <Sheet visible={!!info} onClose={onClose} title={info ? `${info.short} · ${info.label}` : ''}>
      {info && (
        <View style={{ gap: 14 }}>
          <Body size={16}>{info.explainer}</Body>
          <View style={{ backgroundColor: t.c.surfaceAlt, borderRadius: t.radius.md, padding: 12, gap: 4 }}>
            <Eyebrow>Formula</Eyebrow>
            <Text style={{ fontFamily: t.fonts.mono, color: t.c.ink, fontSize: 13 }}>{info.formula}</Text>
          </View>
          <Body soft size={13}>
            {info.better === 'neutral'
              ? 'Neither high nor low is "good" on its own — it depends on the business.'
              : `Colour cues treat ${info.better} values as typically stronger. That's a rule of thumb for learning, not a rating.`}
          </Body>
        </View>
      )}
    </Sheet>
  );
}
