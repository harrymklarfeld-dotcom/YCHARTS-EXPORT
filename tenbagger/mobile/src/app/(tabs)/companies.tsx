import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompanyRow } from '../../components/CompanyRow';
import { Icon } from '../../components/Icon';
import { Body, Disclaimer, Title } from '../../components/ui';
import { getCompanies } from '../../data';
import { getFunds } from '../../funds/data';
import { FundRow } from '../../funds/FundRow';
import { useTheme } from '../../theme';

type Seg = 'stocks' | 'funds';

function EntryCard({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: pressed ? t.c.surfaceAlt : t.c.primarySoft,
        borderRadius: t.radius.md,
        padding: 12,
        gap: 2,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 14 }}>{title}</Text>
        <Icon name="chevron" color={t.c.ink} size={16} />
      </View>
      <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{sub}</Text>
    </Pressable>
  );
}

export default function CompaniesScreen() {
  const t = useTheme();
  const [q, setQ] = useState('');
  const [seg, setSeg] = useState<Seg>('stocks');
  const all = getCompanies();
  const funds = getFunds();
  const s = q.trim().toLowerCase();
  const list = useMemo(
    () => (s ? all.filter((c) => c.ticker.toLowerCase().includes(s) || c.name.toLowerCase().includes(s)) : all),
    [all, s],
  );
  const fundList = useMemo(
    () => (s ? funds.filter((f) => f.ticker.toLowerCase().includes(s) || f.name.toLowerCase().includes(s) || f.category.toLowerCase().includes(s)) : funds),
    [funds, s],
  );
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Title>Companies</Title>
        <Body soft size={14}>
          {seg === 'stocks'
            ? 'Real businesses, real filings. Tap one to explore its numbers and practice with them.'
            : 'Funds are baskets of companies. Tap one to see what’s inside and what it costs.'}
        </Body>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: t.c.surfaceAlt, borderRadius: t.radius.md, padding: 3 }}>
          {(['stocks', 'funds'] as Seg[]).map((k) => {
            const on = seg === k;
            return (
              <Pressable
                key={k}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={k === 'stocks' ? 'Stocks' : 'Funds'}
                onPress={() => setSeg(k)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: t.radius.md - 3, backgroundColor: on ? t.c.surface : 'transparent' }}
              >
                <Text style={{ color: on ? t.c.ink : t.c.inkSoft, fontWeight: '800', fontSize: 14 }}>{k === 'stocks' ? 'Stocks' : 'Funds'}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <EntryCard title="Compare" sub="Up to 3 companies on one chart" onPress={() => router.push('/compare')} />
          <EntryCard title="Portfolio X-ray" sub="See what funds really hold" onPress={() => router.push('/xray')} />
        </View>
        <TextInput
          accessibilityLabel={seg === 'stocks' ? 'Search companies' : 'Search funds'}
          placeholder={seg === 'stocks' ? 'Search ticker or name' : 'Search fund, ticker or category'}
          placeholderTextColor={t.c.inkSoft}
          value={q}
          onChangeText={setQ}
          autoCapitalize="characters"
          style={{ backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.line, borderRadius: t.radius.md, padding: 12, color: t.c.ink, fontSize: 16 }}
        />
        <View style={{ gap: 8 }}>
          {seg === 'stocks'
            ? list.map((c) => <CompanyRow key={c.ticker} company={c} metrics={['market_cap', 'net_margin']} />)
            : fundList.map((f) => <FundRow key={f.ticker} fund={f} />)}
        </View>
        <Disclaimer compact />
      </ScrollView>
    </SafeAreaView>
  );
}
