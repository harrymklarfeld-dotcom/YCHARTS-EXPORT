// Deep link to one Money dashboard tab: /money/credit, /money/report, …
import { Stack, useLocalSearchParams } from 'expo-router';
import { isDashTab, TAB_TITLES } from '../../money/dashboard';
import MoneyScreen from '../../money/MoneyScreen';

export default function MoneyTabRoute() {
  const { tab } = useLocalSearchParams<{ tab: string }>();
  const id = isDashTab(tab) ? tab : 'overview';
  return (
    <>
      <Stack.Screen options={{ title: `Money · ${TAB_TITLES[id]}`, headerBackTitle: 'Back' }} />
      <MoneyScreen initialTab={id} embedded />
    </>
  );
}
