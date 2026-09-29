// Short Money explainers: /money/learn/diversification, /money/learn/utilization, …
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '../../../components/Icon';
import { Body, Card, Disclaimer, Eyebrow, Title } from '../../../components/ui';
import { getLesson } from '../../../data';
import { getLearnTopic, LEARN_TOPICS } from '../../../money/learn';
import { useTheme } from '../../../theme';

export default function MoneyLearnRoute() {
  const t = useTheme();
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const item = getLearnTopic(String(topic));
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: 20, gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: 48 }}>
      <Stack.Screen options={{ title: item ? item.title : 'Learn', headerBackTitle: 'Back' }} />
      {item ? (
        <>
          <View style={{ gap: 6 }}>
            <Eyebrow>{item.eyebrow}</Eyebrow>
            <Title>{item.title}</Title>
          </View>
          <Card style={{ gap: 12 }}>
            {item.paragraphs.map((p) => (
              <Body key={p}>{p}</Body>
            ))}
          </Card>
          {item.lessons.map((id) => {
            const l = getLesson(id);
            if (!l) return null;
            return (
              <Pressable
                key={id}
                accessibilityRole="link"
                accessibilityLabel={`Open lesson: ${l.lesson.title}`}
                onPress={() => router.push(`/lesson/${id}`)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: t.radius.md, borderWidth: 1.5, borderColor: t.c.primary, backgroundColor: pressed ? t.c.primarySoft : t.c.surface })}
              >
                <Icon name="book" color={t.c.primary} size={18} />
                <Text style={{ flex: 1, color: t.c.primary, fontWeight: '800' }}>Lesson: {l.lesson.title}</Text>
                <Icon name="chevron" color={t.c.primary} size={14} />
              </Pressable>
            );
          })}
        </>
      ) : (
        <Card style={{ gap: 8 }}>
          <Title size={22}>Topic not found</Title>
          <Body soft>Try one of: {Object.values(LEARN_TOPICS).map((x) => x.title).join(', ')}.</Body>
        </Card>
      )}
      <Disclaimer />
    </ScrollView>
  );
}
