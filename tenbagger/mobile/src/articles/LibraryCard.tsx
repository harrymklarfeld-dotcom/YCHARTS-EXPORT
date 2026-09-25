import { router } from 'expo-router';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from '../components/Icon';
import { Button, ProgressBar } from '../components/ui';
import { useTheme } from '../theme';
import { getArticle, getArticles } from './data';
import { librarySummary } from './progress';
import { useArticles } from './store';

/**
 * Entry point to the articles library, designed for the Learn tab.
 * Usage (in src/app/(tabs)/index.tsx):  import { LibraryCard } from '../../articles';  …  <LibraryCard />
 * Shows read count, and "Continue" (last opened, unfinished) or "Start" (next unread) plus "Browse".
 */
export function LibraryCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const reads = useArticles((s) => s.reads);
  const articles = getArticles();
  if (!articles.length) return null;
  const sum = librarySummary(articles, reads);
  const focusSlug = sum.continueSlug ?? sum.nextSlug;
  const focus = focusSlug ? getArticle(focusSlug) : undefined;
  return (
    <View style={[{ backgroundColor: t.c.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.c.line, padding: 16, gap: 12 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="book" color={t.c.primary} size={24} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' }}>Library</Text>
          <Text style={{ color: t.c.ink, fontFamily: t.fonts.display, fontSize: 18, fontWeight: '700' }}>Short reads with live numbers</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ProgressBar value={sum.total ? sum.read / sum.total : 0} height={8} label={`${sum.read} of ${sum.total} articles read`} />
        <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
          {sum.read}/{sum.total} read
        </Text>
      </View>
      {focus && (
        <View style={{ gap: 2 }}>
          <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '700' }}>{sum.continueSlug ? 'Continue reading' : 'Up next'}</Text>
          <Text style={{ color: t.c.ink, fontSize: 15, fontWeight: '800' }} numberOfLines={2}>
            {focus.title}
          </Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {focus && (
          <Button
            label={sum.continueSlug ? 'Continue' : 'Start reading'}
            onPress={() => router.push(`/articles/${focus.slug}`)}
            style={{ flex: 1, paddingVertical: 11 }}
          />
        )}
        <Button label="Browse all" variant="secondary" onPress={() => router.push('/articles')} style={{ flex: 1, paddingVertical: 11 }} />
      </View>
    </View>
  );
}
