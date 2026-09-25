import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { getLesson } from '../../data';
import type { ConcentrationOutput } from '../../lib/screener';
import { useTheme } from '../../theme';

/** Teaching callout when most matches share one sector. Hidden otherwise. */
export function ConcentrationCallout({ out }: { out: ConcentrationOutput }) {
  const t = useTheme();
  if (!out.isConcentrated || !out.note) return null;
  const lesson = getLesson(out.note.lessonId);
  return (
    <View
      accessibilityRole="summary"
      style={{ backgroundColor: t.c.accentSoft, borderRadius: t.radius.md, padding: 14, gap: 8, borderLeftWidth: 4, borderLeftColor: t.c.accent }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="book" color={t.c.accent} size={16} />
        <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 13 }}>
          {Math.round((out.top?.share ?? 0) * 100)}% of matches: {out.top?.sector}
        </Text>
      </View>
      <Text style={{ color: t.c.ink, fontSize: 14, lineHeight: 20 }}>{out.note.text}</Text>
      {lesson ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${out.note.linkLabel}: lesson ${lesson.lesson.title}`}
          onPress={() => router.push(`/lesson/${out.note!.lessonId}`)}
          hitSlop={8}
        >
          <Text style={{ color: t.c.primary, fontWeight: '800', fontSize: 14 }}>
            {out.note.linkLabel} → <Text style={{ fontWeight: '600' }}>{lesson.lesson.title}</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
