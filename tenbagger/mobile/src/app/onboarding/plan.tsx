// Optional "Build my full plan" / "Edit my setup". /onboarding/plan?step=goals|income|bills|spending|balances|comfort|style
import { Stack, useLocalSearchParams } from 'expo-router';
import { FULL_PLAN_STEPS, type SetupStep } from '../../budget/engine';
import FullPlanFlow from '../../budget/onboarding/FullPlanFlow';

export default function FullPlanRoute() {
  const { step } = useLocalSearchParams<{ step?: string }>();
  const s = FULL_PLAN_STEPS.includes(step as SetupStep) ? (step as SetupStep) : undefined;
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FullPlanFlow {...(s ? { initialStep: s } : {})} />
    </>
  );
}
