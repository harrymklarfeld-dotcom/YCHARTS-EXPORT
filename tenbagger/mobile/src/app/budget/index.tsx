// /budget — the Budget screen. /budget?sample=1 shows the fictional Alex plan.
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import BudgetScreen from '../../budget/BudgetScreen';
import { useBudgetStore } from '../../budget/store';

export default function BudgetRoute() {
  const { sample } = useLocalSearchParams<{ sample?: string }>();
  useEffect(() => {
    if (sample === '1') useBudgetStore.getState().setSampleMode(true);
  }, [sample]);
  return (
    <>
      <Stack.Screen options={{ title: 'Budget', headerBackTitle: 'Back' }} />
      <BudgetScreen embedded />
    </>
  );
}
