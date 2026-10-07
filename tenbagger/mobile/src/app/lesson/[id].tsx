import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { LessonPlayer, useEnsureHeartsFresh } from '../../components/lesson/LessonPlayer';
import { Body, Title } from '../../components/ui';
import { getLesson } from '../../data';
import { useTheme } from '../../theme';

export default function LessonRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  useEnsureHeartsFresh();
  const found = id ? getLesson(String(id)) : undefined;
  if (!found) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg, padding: 24, justifyContent: 'center' }}>
        <Title>Lesson not found</Title>
        <Body soft>It may have been removed in a content update.</Body>
      </View>
    );
  }
  return <LessonPlayer key={found.lesson.id} lesson={found.lesson} mode="lesson" />;
}
