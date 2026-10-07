// /budget/insights — the ranked insights list on its own.
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import BudgetScreen from '../../budget/BudgetScreen';
import { useBudgetStore } from '../../budget/store';

export default function BudgetInsightsRoute() {
  const { sample } = useLocalSearchParams<{ sample?: string }>();
  useEffect(() => {
    if (sample === '1') useBudgetStore.getState().setSampleMode(true);
  }, [sample]);
  return (
    <>
      <Stack.Screen options={{ title: 'Budget insights', headerBackTitle: 'Back' }} />
      <BudgetScreen embedded section="insights" />
    </>
  );
}
