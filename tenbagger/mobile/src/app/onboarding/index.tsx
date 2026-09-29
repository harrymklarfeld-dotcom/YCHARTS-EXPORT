// Quick setup (4 inputs → "Safe to spend until payday"). /onboarding?step=0..4
import { Stack, useLocalSearchParams } from 'expo-router';
import QuickSetupScreen from '../../budget/onboarding/QuickSetupScreen';

export default function OnboardingRoute() {
  const { step } = useLocalSearchParams<{ step?: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <QuickSetupScreen initialStep={Number(step ?? 0) || 0} />
    </>
  );
}
