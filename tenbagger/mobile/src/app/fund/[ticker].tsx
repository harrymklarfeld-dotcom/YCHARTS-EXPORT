import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { TickerBadge } from '../../components/CompanyRow';
import { Icon } from '../../components/Icon';
import { MetricExplainer } from '../../components/MetricExplainer';
import { Sheet } from '../../components/Sheet';
import { Body, Button, Card, Disclaimer, Eyebrow, Title } from '../../components/ui';
import { getCompany, getLesson } from '../../data';
import { Donut, SampleBadge, WeightBar } from '../../funds/charts';
import { getFund } from '../../funds/data';
import { expensePercent, expenseSentence, holdingsSentence, lookThroughSentence, topShare } from '../../funds/facts';
import { formatMultiple, formatPercent, formatUsdCompact } from '../../lib/format';
import { useTheme } from '../../theme';

const LEARN_PE_LESSON = 'u7-l2';

function Fact({ title, big, sub }: { title: string; big: string; sub?: string }) {
  const t = useTheme();
  return (
    <View accessible accessibilityLabel={`${title}: ${big}${sub ? `. ${sub}` : ''}`} style={{ backgroundColor: t.c.surface, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.c.line, padding: 14, gap: 3 }}>
      <Eyebrow>{title}</Eyebrow>
      <Text style={{ color: t.c.ink, fontSize: 18, fontWeight: '800' }}>{big}</Text>
      {sub ? <Body soft size={12}>{sub}</Body> : null}
    </View>
  );
}

export default function FundScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const t = useTheme();
  const [explain, setExplain] = useState<string | null>(null);
  const [etfSheet, setEtfSheet] = useState(false);
  const f = ticker ? getFund(String(ticker)) : undefined;

  if (!f) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg, padding: 24 }}>
        <Stack.Screen options={{ title: 'Fund' }} />
        <Title>Fund not found</Title>
      </View>
    );
  }
  const top10 = f.top_holdings.slice(0, 10);
  const maxW = Math.max(...top10.map((h) => h.weight ?? 0), 0.0001);
  const alloc = f.allocation;
  const sectors = Object.entries(f.sector_weights)
    .filter((e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0)
    .sort((a, b) => (a[0] === 'Unclassified' ? 1 : b[0] === 'Unclassified' ? -1 : b[1] - a[1]));
  const maxSector = Math.max(...sectors.map((s) => s[1]), 0.0001);
  const lt = f.look_through;
  const peLesson = getLesson(LEARN_PE_LESSON);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <Stack.Screen options={{ title: f.ticker, headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <TickerBadge ticker={f.ticker} size={60} />
          <View style={{ flex: 1, gap: 6 }}>
            <Title size={22}>{f.name}</Title>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <View style={{ backgroundColor: t.c.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: t.c.ink, fontSize: 11, fontWeight: '800' }}>{f.category}</Text>
              </View>
              {f.is_sample && <SampleBadge />}
              <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{f.issuer}</Text>
            </View>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Fact title="What it costs you" big={expenseSentence(f.expense_ratio)} sub={`Expense ratio ${expensePercent(f.expense_ratio)}, taken from the fund automatically.`} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Fact title="Holdings" big={holdingsSentence(f.holdings_count)} sub={top10.length > 1 ? `Top 10 are ${formatPercent(topShare(f, 10), 0)} of the fund` : undefined} />
            </View>
            <View style={{ flex: 1 }}>
              <Fact title="Fund size" big={formatUsdCompact(f.total_net_assets)} sub="Total money invested in it" />
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Learn: what an ETF is"
            onPress={() => setEtfSheet(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
          >
            <Icon name="book" color={t.c.primary} size={18} />
            <Text style={{ color: t.c.primary, fontWeight: '800', fontSize: 14 }}>Learn: what an ETF is</Text>
          </Pressable>
        </View>

        {top10.length > 0 && (
          <Card style={{ gap: 8 }}>
            <Eyebrow>What’s inside · top {top10.length}</Eyebrow>
            {top10.map((h, i) => {
              const linked = h.ticker && getCompany(h.ticker) ? h.ticker : null;
              return (
                <WeightBar
                  key={`${h.name}${i}`}
                  label={h.name}
                  sub={h.ticker ?? undefined}
                  value={h.weight ?? 0}
                  max={maxW}
                  onPress={linked ? () => router.push(`/company/${linked}`) : undefined}
                  a11yHint={linked ? 'Opens company page' : undefined}
                />
              );
            })}
            <Body soft size={12}>Tap a company with › to see its numbers.</Body>
          </Card>
        )}

        {alloc && (
          <Card style={{ gap: 12 }}>
            <Eyebrow>What kind of things it owns</Eyebrow>
            <Donut
              title="Asset mix"
              center={alloc.stock >= 0.5 ? `${Math.round(alloc.stock * 100)}% stocks` : alloc.commodity >= 0.5 ? 'Gold' : undefined}
              slices={[
                { label: 'Stocks', value: alloc.stock },
                { label: 'Bonds', value: alloc.bond },
                { label: 'Cash', value: alloc.cash },
                { label: 'Commodities', value: alloc.commodity },
                { label: 'Other', value: alloc.other, neutral: true },
              ]}
            />
          </Card>
        )}

        {sectors.length > 0 && (
          <Card style={{ gap: 8 }}>
            <Eyebrow>Sectors</Eyebrow>
            {sectors.map(([s, w]) => (
              <WeightBar key={s} label={s === 'Unclassified' ? 'Not classified yet' : s} value={w} max={maxSector} muted={s === 'Unclassified'} />
            ))}
            <Body soft size={12}>Our own sector labels. “Not classified yet” is the part of the fund we can’t label yet.</Body>
          </Card>
        )}

        <Card style={{ gap: 12 }}>
          <Eyebrow>If this fund were one company</Eyebrow>
          <Body size={15}>{lookThroughSentence(f)}</Body>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { k: 'pe', label: 'P/E', v: formatMultiple(lt.weighted_pe) },
              { k: 'roic', label: 'ROIC', v: formatPercent(lt.weighted_roic, 0) },
              { k: 'fcf_yield', label: 'FCF yield', v: formatPercent(lt.weighted_fcf_yield) },
            ].map((m) => (
              <Pressable
                key={m.k}
                accessibilityRole="button"
                accessibilityLabel={`${m.label} ${m.v}. Tap for explanation`}
                onPress={() => setExplain(m.k)}
                style={{ flex: 1, backgroundColor: t.c.surfaceAlt, borderRadius: t.radius.md, padding: 10, gap: 2 }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '700' }}>{m.label}</Text>
                  <Icon name="info" color={t.c.locked} size={13} />
                </View>
                <Text style={{ color: t.c.ink, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{m.v}</Text>
              </Pressable>
            ))}
          </View>
          <Body soft size={12}>
            {lt.coverage_pct > 0
              ? `Based on the ${formatPercent(lt.coverage_pct, 0)} of this fund held in companies we have filings for. P/E is averaged the fair way (by earnings yield), so one very pricey stock can’t dominate.`
              : 'None of this fund’s holdings are companies we cover yet.'}
          </Body>
          {peLesson && (
            <Pressable accessibilityRole="button" accessibilityLabel={`Learn: ${peLesson.lesson.title}`} onPress={() => router.push(`/lesson/${LEARN_PE_LESSON}`)} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Icon name="book" color={t.c.primary} size={16} />
              <Text style={{ color: t.c.primary, fontWeight: '800', fontSize: 13 }}>Learn: {peLesson.lesson.title}</Text>
            </Pressable>
          )}
        </Card>

        {f.note ? <Body soft size={12}>{f.note}</Body> : null}
        <View style={{ gap: 4 }}>
          <Eyebrow>Where this comes from</Eyebrow>
          <Body soft size={12}>
            {f.is_sample
              ? `Sample holdings shaped like an SEC Form N-PORT filing (as of ${f.as_of ?? '—'}). Weights are approximate until live SEC data is loaded.`
              : `SEC Form N-PORT filing as of ${f.as_of ?? '—'} (holdings are published about 60 days after quarter end). Fees from the fund’s prospectus.`}
          </Body>
        </View>
        <Button label="X-ray a sample portfolio" variant="secondary" onPress={() => router.push('/xray')} />
        <Disclaimer compact />
      </ScrollView>
      <MetricExplainer metric={explain} onClose={() => setExplain(null)} />
      <Sheet visible={etfSheet} onClose={() => setEtfSheet(false)} title="What’s an ETF?">
        <View style={{ gap: 12 }}>
          <Body size={16}>
            An exchange-traded fund is one basket that holds many investments at once. Buy one share and you own a thin slice of everything in the basket.
          </Body>
          <Body size={15}>
            It trades during the day like a stock. Most follow a rule, such as “the 500 biggest US companies” or “health-care companies”, so they cost little to run.
          </Body>
          <Body size={15}>
            The expense ratio is the yearly fee. It comes out of the fund automatically, so you never see a bill, but it lowers your return.
          </Body>
          <Body soft size={13}>Funds often own the same big companies. The X-ray shows what you really own once you add them up.</Body>
        </View>
      </Sheet>
    </View>
  );
}
