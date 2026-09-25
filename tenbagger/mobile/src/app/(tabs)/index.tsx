import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoalRing } from '../../components/GoalRing';
import { Icon } from '../../components/Icon';
import { TopStats } from '../../components/TopStats';
import { Body, Button, Eyebrow, Title } from '../../components/ui';
import { getLesson, getUnits } from '../../data';
import { dailyProgress, lessonStatuses, nextLessonId, type LessonStatus } from '../../game';
import { today, useApp } from '../../state/store';
import { useTheme } from '../../theme';

const OFFSETS = [0, 56, 84, 56, 0, -56, -84, -56];

function LessonNode({ title, status, index, onPress }: { title: string; status: LessonStatus; index: number; onPress: () => void }) {
  const t = useTheme();
  const color = status === 'complete' ? t.c.primary : status === 'unlocked' ? t.c.accent : t.c.locked;
  const icon = status === 'complete' ? 'check' : status === 'unlocked' ? 'star' : 'lock';
  return (
    <View style={{ alignItems: 'center', transform: [{ translateX: OFFSETS[index % OFFSETS.length] }], marginVertical: 8 }}>
      {status === 'unlocked' && (
        <View style={{ backgroundColor: t.c.surface, borderColor: t.c.line, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 6 }}>
          <Text style={{ color: t.c.accent, fontWeight: '900', fontSize: 11, letterSpacing: 1 }}>START</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${status === 'locked' ? 'locked' : status === 'complete' ? 'completed, tap to replay' : 'tap to start'}`}
        accessibilityState={{ disabled: status === 'locked' }}
        disabled={status === 'locked'}
        onPress={onPress}
        style={({ pressed }) => ({
          width: 76,
          height: 70,
          borderRadius: 38,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          borderBottomWidth: pressed ? 2 : 7,
          borderBottomColor: 'rgba(0,0,0,0.22)',
          transform: [{ translateY: pressed ? 4 : 0 }],
        })}
      >
        <Icon name={icon} color={status === 'locked' ? t.c.inkSoft : '#fff'} fill={status === 'unlocked' ? '#fff' : 'none'} size={30} strokeWidth={2.4} />
      </Pressable>
      <Text style={{ marginTop: 6, color: status === 'locked' ? t.c.inkSoft : t.c.ink, fontWeight: '700', fontSize: 13, maxWidth: 140, textAlign: 'center' }}>{title}</Text>
    </View>
  );
}

export default function LearnScreen() {
  const t = useTheme();
  const completed = useApp((s) => s.completed);
  const xpLog = useApp((s) => s.xpLog);
  const goal = useApp((s) => s.dailyGoal);
  const units = getUnits();
  const statuses = lessonStatuses(units, completed);
  const next = nextLessonId(units, completed);
  const nextLesson = next ? getLesson(next)?.lesson : undefined;
  const daily = dailyProgress(xpLog, today(), goal);
  let nodeIndex = 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text style={{ fontFamily: t.fonts.display, fontSize: 24, fontWeight: '700', color: t.c.ink, letterSpacing: -0.5 }}>
          ten<Text style={{ color: t.c.primary }}>bagger</Text>
        </Text>
        <TopStats />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 18 }}>
        <View style={{ backgroundColor: t.c.ink, borderRadius: t.radius.lg, padding: 18, flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <View style={{ backgroundColor: t.c.bg, borderRadius: 40, padding: 4 }}>
            <GoalRing earned={daily.earned} goal={daily.goal} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Eyebrow color={t.c.accent}>{daily.met ? 'Goal met — nice' : "Today's goal"}</Eyebrow>
            <Text style={{ color: t.c.bg, fontFamily: t.fonts.display, fontSize: 19, fontWeight: '700' }}>
              {nextLesson ? nextLesson.title : 'Path complete!'}
            </Text>
            {nextLesson ? (
              <Button label="Continue" onPress={() => router.push(`/lesson/${next}`)} style={{ paddingVertical: 10 }} />
            ) : (
              <Body size={13} style={{ color: t.c.bg }}>Replay any lesson or practice with a company.</Body>
            )}
          </View>
        </View>

        {units.map((u, ui) => (
          <View key={u.id} style={{ gap: 6 }}>
            <View style={{ backgroundColor: ui % 2 === 0 ? t.c.primary : t.c.accent, borderRadius: t.radius.md, padding: 16, borderBottomWidth: 5, borderBottomColor: 'rgba(0,0,0,0.2)' }}>
              <Text style={{ color: '#fff', opacity: 0.85, fontWeight: '800', fontSize: 11, letterSpacing: 1.4 }}>UNIT {u.order}</Text>
              <Text accessibilityRole="header" style={{ color: '#fff', fontFamily: t.fonts.display, fontSize: 22, fontWeight: '700' }}>{u.title}</Text>
              <Text style={{ color: '#fff', opacity: 0.9, fontSize: 14, marginTop: 2 }}>{u.summary}</Text>
            </View>
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              {u.lessons.map((l) => (
                <LessonNode key={l.id} title={l.title} status={statuses[l.id]} index={nodeIndex++} onPress={() => router.push(`/lesson/${l.id}`)} />
              ))}
            </View>
          </View>
        ))}
        <Title size={16} style={{ textAlign: 'center', color: t.c.inkSoft }}>More units coming as filings land.</Title>
      </ScrollView>
    </SafeAreaView>
  );
}
