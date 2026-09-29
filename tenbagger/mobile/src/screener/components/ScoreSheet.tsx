import { Text, View } from 'react-native';
import { Sheet } from '../../components/Sheet';
import { Body, Eyebrow } from '../../components/ui';
import { SCORE_FAMILIES, type CompanyScores, type ScoreFamilyId } from '../../lib/screener';
import { useTheme } from '../../theme';

/** "How is this calculated?" — every score shows its inputs, percentiles and formula. */
export function ScoreSheet({
  visible,
  onClose,
  universeSize,
  company,
  focus,
}: {
  visible: boolean;
  onClose: () => void;
  universeSize: number;
  company?: { ticker: string; name: string; scores: CompanyScores } | null;
  focus?: ScoreFamilyId | null;
}) {
  const t = useTheme();
  const families = focus ? [...SCORE_FAMILIES].sort((a, b) => (a.id === focus ? -1 : b.id === focus ? 1 : 0)) : SCORE_FAMILIES;
  return (
    <Sheet visible={visible} onClose={onClose} title="How is this calculated?">
      <View style={{ gap: 16 }}>
        <Body size={14}>
          Each score is a plain average of percentiles within the {universeSize} companies in this app. 100 means “highest in this list on
          these inputs”, 0 means “lowest”. They are a study aid, not a rating: add or remove companies and the numbers move.
        </Body>
        {company ? (
          <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 15 }}>
            {company.name} ({company.ticker})
          </Text>
        ) : null}
        {families.map((f) => {
          const fam = company?.scores[f.id];
          return (
            <View key={f.id} style={{ gap: 8, backgroundColor: t.c.surfaceAlt, borderRadius: t.radius.md, padding: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: t.fonts.display, fontSize: 18, fontWeight: '700', color: t.c.ink }}>{f.label}</Text>
                {fam ? (
                  <Text style={{ color: t.c.ink, fontWeight: '900', fontSize: 18, fontVariant: ['tabular-nums'] }}>{fam.score ?? '—'}</Text>
                ) : null}
              </View>
              <Body soft size={13}>{f.question}</Body>
              {fam ? (
                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row' }}>
                    <Text style={{ flex: 2, color: t.c.inkSoft, fontSize: 11, fontWeight: '800' }}>INPUT</Text>
                    <Text style={{ flex: 1, color: t.c.inkSoft, fontSize: 11, fontWeight: '800', textAlign: 'right' }}>VALUE</Text>
                    <Text style={{ flex: 1.3, color: t.c.inkSoft, fontSize: 11, fontWeight: '800', textAlign: 'right' }}>PERCENTILE</Text>
                  </View>
                  {fam.components.map((c) => (
                    <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ flex: 2, color: t.c.ink, fontSize: 13 }}>
                        {c.label} <Text style={{ color: t.c.inkSoft }}>({c.better === 'higher' ? 'higher' : 'lower'} ranks higher)</Text>
                      </Text>
                      <Text style={{ flex: 1, color: t.c.ink, fontSize: 13, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] }}>{c.display}</Text>
                      <Text style={{ flex: 1.3, color: t.c.ink, fontSize: 13, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                        {c.percentile === null ? 'no data' : Math.round(c.percentile)}
                      </Text>
                    </View>
                  ))}
                  <Text style={{ fontFamily: t.fonts.mono, color: t.c.ink, fontSize: 12, marginTop: 4 }}>{fam.working}</Text>
                </View>
              ) : (
                <View style={{ gap: 2 }}>
                  {f.components.map((c) => (
                    <Text key={c.id} style={{ color: t.c.ink, fontSize: 13 }}>
                      • {c.label}: <Text style={{ fontFamily: t.fonts.mono, fontSize: 12 }}>{c.formula}</Text>
                    </Text>
                  ))}
                </View>
              )}
              <Eyebrow>Formula</Eyebrow>
              <Body size={13}>{f.formula}</Body>
              <Body soft size={12}>What it can’t see: {f.caveat}</Body>
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}
