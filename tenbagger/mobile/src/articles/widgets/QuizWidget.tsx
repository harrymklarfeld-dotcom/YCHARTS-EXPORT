import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/ui';
import { getLesson } from '../../data';
import { useApp } from '../../state/store';
import { useTheme } from '../../theme';
import { Unsupported, WidgetFrame } from './WidgetFrame';

/**
 * "Practice this" → opens the lesson. XP is awarded by the lesson player on completion,
 * never by reading (REGULATORY/PRODUCT NOTE: rewards stay tied to learning).
 */
export function QuizWidget({ lesson, caption }: { lesson: string; caption?: string }) {
  const t = useTheme();
  const found = getLesson(lesson);
  const done = useApp((s) => s.completed[lesson]);
  if (!found) return <Unsupported reason={`lesson ${lesson} not found`} />;
  const { lesson: l, unit } = found;
  return (
    <WidgetFrame eyebrow="Practice this" caption={caption}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: done ? t.c.primary : t.c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={done ? 'check' : 'star'} color="#fff" fill={done ? 'none' : '#fff'} size={24} strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '700' }}>{unit.title}</Text>
          <Text style={{ color: t.c.ink, fontSize: 17, fontWeight: '800', fontFamily: t.fonts.display }}>{l.title}</Text>
          <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>
            {l.questions.length} questions · {done ? 'completed' : `+${l.xp} XP when you finish`}
          </Text>
        </View>
      </View>
      <Button
        label={done ? 'Practice again' : 'Practice this'}
        variant={done ? 'secondary' : 'primary'}
        onPress={() => router.push(`/lesson/${l.id}`)}
        style={{ paddingVertical: 12 }}
      />
    </WidgetFrame>
  );
}
