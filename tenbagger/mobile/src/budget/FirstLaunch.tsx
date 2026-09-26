/**
 * <BudgetFirstLaunch /> — mount once (root layout or Learn tab). On the very first launch (no plan,
 * onboarding not skipped, storage loaded) it opens the 4-input Quick setup. "Not now" marks it seen,
 * so it never nags. Renders nothing.
 */
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useNeedsBudgetOnboarding } from './hooks';

export function BudgetFirstLaunch({ delayMs = 400 }: { delayMs?: number }) {
  const needs = useNeedsBudgetOnboarding();
  const done = useRef(false);
  useEffect(() => {
    if (!needs || done.current) return;
    done.current = true;
    const id = setTimeout(() => router.push('/onboarding'), delayMs);
    return () => clearTimeout(id);
  }, [needs, delayMs]);
  return null;
}
