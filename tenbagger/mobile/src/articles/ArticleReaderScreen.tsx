import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Icon } from '../components/Icon';
import { Button, Disclaimer, ProgressBar } from '../components/ui';
import { getLesson } from '../data';
import { useApp } from '../state/store';
import { useTheme } from '../theme';
import { Markdown } from './components/Markdown';
import { LevelTag, Tag } from './components/Tag';
import { getArticle, nextArticle } from './data';
import { useArticles } from './store';
import { WidgetView } from './widgets/WidgetView';

export function ArticleReaderScreen({ slug }: { slug: string }) {
  const t = useTheme();
  const article = getArticle(slug);
  const st = useArticles((s) => s.reads[slug]);
  const setProgress = useArticles((s) => s.setProgress);
  const markRead = useArticles((s) => s.markRead);
  const opened = useArticles((s) => s.opened);
  const completed = useApp((s) => s.completed);
  const [local, setLocal] = useState(0);
  const layoutH = useRef(0);

  useEffect(() => {
    if (article) opened(article.slug);
  }, [article, opened]);

  if (!article) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg, padding: 24, justifyContent: 'center', gap: 8 }}>
        <Text style={{ fontFamily: t.fonts.display, fontSize: 26, fontWeight: '700', color: t.c.ink }}>Article not found</Text>
        <Text style={{ color: t.c.inkSoft }}>It may have been renamed in a content update.</Text>
        <Button label="Open the library" onPress={() => router.replace('/articles')} />
      </View>
    );
  }

  const read = !!st?.readAt;
  const next = nextArticle(article.slug);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const h = layoutMeasurement.height || layoutH.current;
    const scrollable = Math.max(1, contentSize.height - h);
    const p = Math.min(1, Math.max(0, contentOffset.y / scrollable));
    setLocal(p);
    setProgress(article.slug, p);
  };
  const shown = read ? 1 : Math.max(local, st?.progress ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 6 }}>
        <ProgressBar value={shown} height={4} label={`${Math.round(shown * 100)}% read`} />
      </View>
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={100}
        onLayout={(e) => (layoutH.current = e.nativeEvent.layout.height)}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 56, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <LevelTag level={article.level} />
          <Text style={{ color: t.c.inkSoft, fontSize: 13, fontWeight: '700' }}>
            {article.minutes} min read · {article.widgetCount} interactive
          </Text>
        </View>
        <Text accessibilityRole="header" style={{ fontFamily: t.fonts.display, fontSize: 30, lineHeight: 36, fontWeight: '700', color: t.c.ink, letterSpacing: -0.6 }}>
          {article.title}
        </Text>
        <Text style={{ color: t.c.inkSoft, fontSize: 17, lineHeight: 25 }}>{article.summary}</Text>
        {article.sampleTickers.length > 0 && (
          <View style={{ backgroundColor: t.c.accentSoft, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 }}>
            <Text style={{ color: t.c.ink, fontSize: 13, lineHeight: 18 }}>
              <Text style={{ fontWeight: '800' }}>Sample data: </Text>
              {article.sampleTickers.join(', ')} figures here are placeholders until live filings are connected. Micron (MU) numbers are reported.
            </Text>
          </View>
        )}
        <View style={{ height: 1, backgroundColor: t.c.line, marginVertical: 4 }} />

        {article.blocks.map((b, i) => (b.type === 'markdown' ? <Markdown key={i} md={b.md} /> : <WidgetView key={i} widget={b.widget} />))}

        <View style={{ height: 1, backgroundColor: t.c.line, marginVertical: 8 }} />
        <Button
          label={read ? 'Read ✓  (tap to mark unread)' : 'Mark as read'}
          variant={read ? 'secondary' : 'primary'}
          onPress={() => markRead(article.slug, !read)}
        />
        <Text style={{ color: t.c.inkSoft, fontSize: 12, textAlign: 'center' }}>Reading tracks your progress. XP comes from finishing the practice lessons.</Text>

        {article.relatedLessons.length > 0 && (
          <View style={{ gap: 8, marginTop: 8 }}>
            <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' }}>Related lessons</Text>
            {article.relatedLessons.map((id) => {
              const found = getLesson(id);
              if (!found) return null;
              const done = !!completed[id];
              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={`Lesson: ${found.lesson.title}${done ? ', completed' : ''}`}
                  onPress={() => router.push(`/lesson/${id}`)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: pressed ? t.c.surfaceAlt : t.c.surface,
                    borderWidth: 1,
                    borderColor: t.c.line,
                    borderRadius: 12,
                    padding: 12,
                  })}
                >
                  <Icon name={done ? 'check' : 'star'} color={done ? t.c.primary : t.c.accent} size={18} strokeWidth={2.6} />
                  <Text style={{ flex: 1, color: t.c.ink, fontWeight: '700' }}>{found.lesson.title}</Text>
                  <Icon name="chevron" color={t.c.inkSoft} size={16} />
                </Pressable>
              );
            })}
          </View>
        )}

        {next && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Next article: ${next.title}`}
            onPress={() => router.replace(`/articles/${next.slug}`)}
            style={({ pressed }) => ({ backgroundColor: t.c.ink, borderRadius: t.radius.lg, padding: 16, gap: 4, marginTop: 8, opacity: pressed ? 0.9 : 1 })}
          >
            <Text style={{ color: t.c.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' }}>Next up</Text>
            <Text style={{ color: t.c.bg, fontFamily: t.fonts.display, fontSize: 18, fontWeight: '700' }}>{next.title}</Text>
          </Pressable>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {article.tags.map((tag) => (
            <Tag key={tag} label={`#${tag}`} />
          ))}
        </View>
        <Disclaimer compact />
      </ScrollView>
    </View>
  );
}
