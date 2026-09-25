import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompanyRow } from '../../components/CompanyRow';
import { Body, Disclaimer, Title } from '../../components/ui';
import { getCompanies } from '../../data';
import { useTheme } from '../../theme';

export default function CompaniesScreen() {
  const t = useTheme();
  const [q, setQ] = useState('');
  const all = getCompanies();
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? all.filter((c) => c.ticker.toLowerCase().includes(s) || c.name.toLowerCase().includes(s)) : all;
  }, [all, q]);
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Title>Companies</Title>
        <Body soft size={14}>Real businesses, real filings. Tap one to explore its numbers and practice with them.</Body>
        <TextInput
          accessibilityLabel="Search companies"
          placeholder="Search ticker or name"
          placeholderTextColor={t.c.inkSoft}
          value={q}
          onChangeText={setQ}
          autoCapitalize="characters"
          style={{ backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.line, borderRadius: t.radius.md, padding: 12, color: t.c.ink, fontSize: 16 }}
        />
        <View style={{ gap: 8 }}>
          {list.map((c) => (
            <CompanyRow key={c.ticker} company={c} metrics={['market_cap', 'net_margin']} />
          ))}
        </View>
        <Disclaimer compact />
      </ScrollView>
    </SafeAreaView>
  );
}
