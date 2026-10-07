// /budget/edit — "Edit my setup" (Settings can link here).
import { Redirect } from 'expo-router';

export default function BudgetEditRoute() {
  return <Redirect href="/onboarding/plan" />;
}
