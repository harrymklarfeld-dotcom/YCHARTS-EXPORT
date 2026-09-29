import { Stack, useLocalSearchParams } from 'expo-router';
import { ArticleReaderScreen } from '../../articles';

export default function ArticleRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const s = String(slug ?? '');
  return (
    <>
      <Stack.Screen options={{ title: '', headerBackTitle: 'Library' }} />
      <ArticleReaderScreen key={s} slug={s} />
    </>
  );
}
