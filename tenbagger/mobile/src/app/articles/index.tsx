import { Stack } from 'expo-router';
import { ArticleListScreen } from '../../articles';

export default function ArticlesIndexRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Library', headerBackTitle: 'Back' }} />
      <ArticleListScreen />
    </>
  );
}
