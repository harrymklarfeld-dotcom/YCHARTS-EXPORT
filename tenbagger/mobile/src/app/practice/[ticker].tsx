import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { LessonPlayer, useEnsureHeartsFresh } from '../../components/lesson/LessonPlayer';
import { Body, Title } from '../../components/ui';
import { getCompany, getUnits } from '../../data';
import { practiceLessonFor } from '../../lib/practice';
import { useTheme } from '../../theme';

export default function PracticeRoute() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const t = useTheme();
  useEnsureHeartsFresh();
  const company = ticker ? getCompany(String(ticker)) : undefined;
  const lesson = useMemo(() => (company ? practiceLessonFor(company, getUnits()) : undefined), [company]);
  if (!company || !lesson || lesson.questions.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg, padding: 24, justifyContent: 'center' }}>
        <Title>No practice yet</Title>
        <Body soft>We don't have enough data for {String(ticker ?? '')} to build questions.</Body>
      </View>
    );
  }
  return <LessonPlayer key={lesson.id} lesson={lesson} mode="practice" />;
}
