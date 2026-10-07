import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { ProgressBar } from '../../components/ui';
import { useTheme } from '../../theme';
import { useArticles } from '../store';
import type { Article } from '../types';
import { LevelTag, Tag } from './Tag';

export function ArticleCard({ article }: { article: Article }) {
  const t = useTheme();
  const st = useArticles((s) => s.reads[article.slug]);
  const read = !!st?.readAt;
  const progress = st?.progress ?? 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${article.title}. ${article.level}, ${article.minutes} minute read${read ? ', read' : progress > 0 ? `, ${Math.round(progress * 100)}% read` : ''}`}
      onPress={() => router.push(`/articles/${article.slug}`)}
      style={({ pressed }) => ({
        backgroundColor: t.c.surface,
        borderRadius: t.radius.lg,
        borderWidth: 1,
        borderColor: t.c.line,
        borderBottomWidth: pressed ? 1 : 3,
        padding: 16,
        gap: 8,
        transform: [{ translateY: pressed ? 2 : 0 }],
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <LevelTag level={article.level} />
        <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '700' }}>
          {article.minutes} min · {article.widgetCount} interactive
        </Text>
        <View style={{ flex: 1 }} />
        {read && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="check" color={t.c.primary} size={16} strokeWidth={3} />
            <Text style={{ color: t.c.primary, fontSize: 12, fontWeight: '800' }}>Read</Text>
          </View>
        )}
      </View>
      <Text style={{ color: t.c.ink, fontFamily: t.fonts.display, fontSize: 19, fontWeight: '700', lineHeight: 24 }}>{article.title}</Text>
      <Text style={{ color: t.c.inkSoft, fontSize: 14, lineHeight: 20 }} numberOfLines={3}>
        {article.summary}
      </Text>
      {!read && progress > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <ProgressBar value={progress} height={6} label={`${Math.round(progress * 100)}% read`} />
          <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '700' }}>{Math.round(progress * 100)}%</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {article.tags.slice(0, 3).map((tag) => (
          <Tag key={tag} label={`#${tag}`} />
        ))}
      </View>
    </Pressable>
  );
}
