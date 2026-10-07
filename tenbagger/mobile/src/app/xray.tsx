import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '../components/Icon';
import { MetricExplainer } from '../components/MetricExplainer';
import { Body, Card, Disclaimer, Eyebrow, Title } from '../components/ui';
import { getCompanies } from '../data';
import { Donut, WeightBar } from '../funds/charts';
import { getFunds } from '../funds/data';
import { SAMPLE_PORTFOLIO } from '../funds/samplePortfolio';
import { xray, type Exposure } from '../funds/xray';
import { formatMultiple, formatPercent } from '../lib/format';
import { useTheme } from '../theme';

const p1 = (v: number) => `${(v * 100).toFixed(1)}%`;
const SHOW = 12;

function ExposureRow({ e, max }: { e: Exposure; max: number }) {
  const t = useTheme();
  const parts = [e.direct > 0 ? `${p1(e.direct)} direct` : null, ...e.via.map((v) => `${p1(v.weight)} via ${v.fund}`)].filter(Boolean).join(' + ');
  const linked = e.inCompanies && e.ticker;
  const dW = max > 0 ? (e.direct / max) * 100 : 0;
  const vW = max > 0 ? ((e.total - e.direct) / max) * 100 : 0;
  const label = `${e.ticker ?? e.name}: ${p1(e.total)} of your money. ${parts}.${linked ? ' Opens company page.' : ''}`;
  return (
    <Pressable
      accessibilityRole={linked ? 'button' : 'text'}
      accessibilityLabel={label}
      disabled={!linked}
      onPress={() => linked && router.push(`/company/${e.ticker}`)}
      style={({ pressed }) => ({ gap: 4, paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, color: t.c.ink, fontWeight: '800', fontSize: 14 }}>
          {e.ticker ?? e.name}
          {e.ticker ? <Text style={{ color: t.c.inkSoft, fontWeight: '600', fontSize: 12 }}>{`  ${e.name}`}</Text> : null}
        </Text>
        <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 14, fontVariant: ['tabular-nums'] }}>{p1(e.total)}</Text>
        {linked ? <Text style={{ color: t.c.inkSoft }}>›</Text> : null}
      </View>
      <View style={{ height: 8, flexDirection: 'row', backgroundColor: t.c.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
        {dW > 0 && <View style={{ width: `${dW}%`, backgroundColor: t.c.primary }} />}
        {dW > 0 && vW > 0 && <View style={{ width: 2, backgroundColor: t.c.surface }} />}
        {vW > 0 && <View style={{ width: `${vW}%`, backgroundColor: t.c.accent }} />}
      </View>
      <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{parts}</Text>
    </Pressable>
  );
}

export default function XrayScreen() {
  const t = useTheme();
  const [explain, setExplain] = useState<string | null>(null);
  const r = useMemo(() => xray(SAMPLE_PORTFOLIO, getFunds(), getCompanies()), []);
  const top = r.exposures.slice(0, SHOW);
  const maxE = top[0]?.total ?? 0;
  const maxS = r.sectors[0]?.weight ?? 0;
  const lead = r.exposures[0];

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <Stack.Screen options={{ title: 'Portfolio X-ray', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <View style={{ gap: 6 }}>
          <Title>Portfolio X-ray</Title>
          <Body soft size={14}>Funds hide what you own. We open each one up and add everything together.</Body>
          <View style={{ alignSelf: 'flex-start', backgroundColor: t.c.accentSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: t.c.ink, fontSize: 11, fontWeight: '800' }}>Fictional sample portfolio · link a brokerage later</Text>
          </View>
        </View>

        <Card style={{ gap: 8 }}>
          <Eyebrow>What’s in the account</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {r.positions.map((p) => (
              <Pressable
                key={p.ticker}
                accessibilityRole={p.kind === 'cash' ? 'text' : 'button'}
                accessibilityLabel={`${p.name}, ${p1(p.weight)}${p.kind === 'fund' ? ', fund' : ''}`}
                disabled={p.kind === 'cash' || p.kind === 'unknown'}
                onPress={() => router.push(p.kind === 'fund' ? `/fund/${p.ticker}` : `/company/${p.ticker}`)}
                style={{ flexDirection: 'row', gap: 6, alignItems: 'center', borderWidth: 1, borderColor: t.c.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: p.kind === 'fund' ? t.c.primarySoft : t.c.surface }}
              >
                <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 13 }}>{p.kind === 'cash' ? 'Cash' : p.ticker}</Text>
                <Text style={{ color: t.c.inkSoft, fontSize: 12, fontVariant: ['tabular-nums'] }}>{p1(p.weight)}</Text>
              </Pressable>
            ))}
          </View>
          <Body soft size={12}>Green chips are funds. Tap one to look inside it.</Body>
        </Card>

        {lead && (
          <View accessible accessibilityLabel={`Your biggest real holding is ${lead.ticker ?? lead.name} at ${p1(lead.total)}`} style={{ gap: 2 }}>
            <Eyebrow>Your biggest real holding</Eyebrow>
            <Text style={{ color: t.c.ink, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
              {lead.ticker ?? lead.name} {p1(lead.total)}
            </Text>
          </View>
        )}

        {r.warnings.length > 0 && (
          <View style={{ gap: 8 }}>
            {r.warnings.map((w, i) => (
              <View key={i} accessibilityRole="alert" style={{ flexDirection: 'row', gap: 10, backgroundColor: w.severity === 'caution' ? t.c.accentSoft : t.c.surfaceAlt, borderRadius: t.radius.md, padding: 12 }}>
                <Icon name="info" color={t.c.ink} size={18} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 13 }}>
                    {w.kind === 'overlap' ? 'Same company, several routes' : w.kind === 'fund_overlap' ? 'Funds that overlap' : 'One big position'}
                  </Text>
                  <Text style={{ color: t.c.ink, fontSize: 13 }}>{w.message}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Card style={{ gap: 6 }}>
          <Eyebrow>What you really own</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 14, marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: t.c.primary }} />
              <Text style={{ color: t.c.ink, fontSize: 12 }}>Owned directly</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: t.c.accent }} />
              <Text style={{ color: t.c.ink, fontSize: 12 }}>Through funds</Text>
            </View>
          </View>
          {top.map((e) => (
            <ExposureRow key={e.key} e={e} max={maxE} />
          ))}
          <Body soft size={12}>
            {`${p1(r.unseenFundWeight)} of your money sits in fund holdings smaller than each fund’s top 25, which we don’t list one by one.`}
          </Body>
        </Card>

        <Card style={{ gap: 8 }}>
          <Eyebrow>Sector mix, looking through funds</Eyebrow>
          {r.sectors.map((s) => (
            <WeightBar key={s.sector} label={s.sector === 'Unclassified' ? 'Not classified yet' : s.sector} value={s.weight} max={maxS} muted={s.sector === 'Unclassified'} />
          ))}
        </Card>

        <Card style={{ gap: 12 }}>
          <Eyebrow>Asset mix</Eyebrow>
          <Donut
            title="Asset mix"
            center={`${Math.round(r.assetMix.stock * 100)}% stocks`}
            slices={[
              { label: 'Stocks', value: r.assetMix.stock },
              { label: 'Bonds', value: r.assetMix.bond },
              { label: 'Cash', value: r.assetMix.cash },
              { label: 'Gold & commodities', value: r.assetMix.commodity },
              { label: 'Other', value: r.assetMix.other, neutral: true },
            ]}
          />
        </Card>

        <Card style={{ gap: 12 }}>
          <Eyebrow>If your portfolio were one company</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { k: 'pe', label: 'P/E', v: formatMultiple(r.lookThrough.pe) },
              { k: 'roic', label: 'ROIC', v: formatPercent(r.lookThrough.roic, 0) },
              { k: 'fcf_yield', label: 'FCF yield', v: formatPercent(r.lookThrough.fcfYield) },
            ].map((m) => (
              <Pressable
                key={m.k}
                accessibilityRole="button"
                accessibilityLabel={`${m.label} ${m.v}. Tap for explanation`}
                onPress={() => setExplain(m.k)}
                style={{ flex: 1, backgroundColor: t.c.surfaceAlt, borderRadius: t.radius.md, padding: 10, gap: 2 }}
              >
                <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '700' }}>{m.label}</Text>
                <Text style={{ color: t.c.ink, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{m.v}</Text>
              </Pressable>
            ))}
          </View>
          <Body soft size={12}>
            {`Based on ${formatPercent(r.lookThrough.coverage, 0)} of your money: the companies (direct or inside funds) we have filings for. Gold and cash have no earnings, so they’re left out.`}
          </Body>
        </Card>
        <Disclaimer compact />
      </ScrollView>
      <MetricExplainer metric={explain} onClose={() => setExplain(null)} />
    </View>
  );
}
