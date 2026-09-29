import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Chip, Disclaimer } from '../components/ui';
import { useTheme } from '../theme';
import { ArticleCard } from './components/ArticleCard';
import { LEVEL_LABEL } from './components/Tag';
import { filterArticles, getArticles } from './data';
import { isRead } from './progress';
import { useArticles } from './store';
import { LEVELS, type Level } from './types';

export function ArticleListScreen() {
  const t = useTheme();
  const [q, setQ] = useState('');
  const [level, setLevel] = useState<Level | 'all'>('all');
  const reads = useArticles((s) => s.reads);
  const all = getArticles();
  const list = useMemo(() => filterArticles(all, level, q), [all, level, q]);
  const readCount = all.filter((a) => isRead(reads, a.slug)).length;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={{ fontFamily: t.fonts.display, fontSize: 30, fontWeight: '700', color: t.c.ink, letterSpacing: -0.5 }}>
          Library
        </Text>
        <Text style={{ color: t.c.inkSoft, fontSize: 15, lineHeight: 21 }}>
          Short explainers built on real filings, with numbers you can poke at. {readCount}/{all.length} read.
        </Text>
      </View>
      <TextInput
        accessibilityLabel="Search articles"
        placeholder="Search: margin, cash, DCF…"
        placeholderTextColor={t.c.inkSoft}
        value={q}
        onChangeText={setQ}
        autoCorrect={false}
        style={{ backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.line, borderRadius: t.radius.md, padding: 12, color: t.c.ink, fontSize: 16 }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label="All" selected={level === 'all'} onPress={() => setLevel('all')} />
        {LEVELS.map((l) => (
          <Chip key={l} label={LEVEL_LABEL[l]} selected={level === l} onPress={() => setLevel(l)} />
        ))}
      </ScrollView>
      <View style={{ gap: 12 }}>
        {list.map((a) => (
          <ArticleCard key={a.slug} article={a} />
        ))}
        {!list.length && <Text style={{ color: t.c.inkSoft, fontSize: 15, textAlign: 'center', paddingVertical: 24 }}>No articles match. Try another word or level.</Text>}
      </View>
      <Text style={{ color: t.c.inkSoft, fontSize: 12, lineHeight: 17 }}>
        Micron (MU) figures are reported numbers. Other companies are sample data until live filings are connected, and they are tagged wherever they appear.
      </Text>
      <Disclaimer compact />
    </ScrollView>
  );
}
