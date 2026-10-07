/** Settings › Subscription: current plan, renewal/trial end, manage, restore, test-mode reset. */
import { useState } from 'react';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';
import { Button, Card, Disclaimer, Eyebrow, Title } from '../../components/ui';
import { FREE_LIMITS, LEGAL, LESSON_RULES, PLANS } from '../../config/monetization';
import { useTheme } from '../../theme';
import { useEntitlement, usePaywall, usePurchaseActions, useUsage } from '../hooks';
import { MockPurchasesAdapter } from '../purchases/MockPurchasesAdapter';
import { getPurchases } from '../runtime';
import { useMonetization } from '../store';

function fmtDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function Line({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 }}>
      <Text style={{ color: t.c.inkSoft, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: t.c.ink, fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export function SubscriptionSettings() {
  const t = useTheme();
  const { isPro, isTrial, planId, snapshot } = useEntitlement();
  const usage = useUsage();
  const storeKind = useMonetization((s) => s.purchasesKind);
  const openPaywall = usePaywall();
  const { restore, busy } = usePurchaseActions();
  const [msg, setMsg] = useState<string | null>(null);
  const date = fmtDate(snapshot.expiresAt);
  const lessonLimit = FREE_LIMITS.lessons as number;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
      <View style={{ gap: 6 }}>
        <Eyebrow color={t.c.accent}>Subscription</Eyebrow>
        <Title size={26}>{isPro ? (isTrial ? 'Pro · free trial' : 'Tenbagger Pro') : 'Free plan'}</Title>
      </View>

      <Card style={{ gap: 2 }}>
        <Line label="Plan" value={isPro ? (planId ? PLANS[planId].label : 'Pro') : 'Free'} />
        {isPro && date ? <Line label={isTrial ? 'Trial ends' : snapshot.willRenew ? 'Renews' : 'Ends'} value={date} /> : null}
        {!isPro ? (
          <>
            <Line label="New lessons today" value={`${Math.min(usage.newLessonsToday, lessonLimit)} of ${lessonLimit}`} />
            <Line label="Saved screens" value={`${usage.savedScreens} of ${FREE_LIMITS.saved_screens}`} />
            <Line label="Linked accounts" value={`${usage.linkedAccounts} of ${FREE_LIMITS.money_accounts}`} />
          </>
        ) : null}
        <Line label="Billing" value={storeKind === 'mock' ? 'Test mode (simulated)' : Platform.OS === 'android' ? 'Google Play' : 'App Store'} />
      </Card>

      {!isPro ? (
        <Text style={{ color: t.c.inkSoft, fontSize: 13, lineHeight: 19 }}>
          Free includes the daily puzzle, all of Unit 1, and {lessonLimit} new lesson a day (unlimited for your first {LESSON_RULES.unlimitedFirstDays} days). Replays are always free.
        </Text>
      ) : null}

      <View style={{ gap: 10 }}>
        {!isPro ? <Button label="See Pro plans" onPress={() => openPaywall('settings')} /> : null}
        {isPro && storeKind === 'revenuecat' ? (
          <Button
            variant="secondary"
            label="Manage or cancel subscription"
            onPress={() => void Linking.openURL(Platform.OS === 'android' ? LEGAL.manageSubscriptionAndroid : LEGAL.manageSubscriptionIos)}
          />
        ) : null}
        <Button
          variant="secondary"
          label={busy === 'restore' ? 'Restoring…' : 'Restore purchases'}
          disabled={!!busy}
          onPress={async () => {
            const snap = await restore();
            setMsg(snap.tier === 'pro' ? 'Purchases restored. Pro is active.' : 'No active subscription found for this account.');
          }}
        />
        {storeKind === 'mock' && isPro ? (
          <Button
            variant="ghost"
            label="Reset simulated purchase (test mode)"
            onPress={() => {
              const p = getPurchases();
              if (p instanceof MockPurchasesAdapter) p.reset();
              setMsg('Simulated purchase cleared.');
            }}
          />
        ) : null}
        {msg ? <Text style={{ color: t.c.ink, fontSize: 13, textAlign: 'center' }}>{msg}</Text> : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 18, justifyContent: 'center' }}>
        <Text accessibilityRole="link" onPress={() => void Linking.openURL(LEGAL.termsUrl)} style={{ color: t.c.inkSoft, textDecorationLine: 'underline', fontSize: 13 }}>
          Terms of Use
        </Text>
        <Text accessibilityRole="link" onPress={() => void Linking.openURL(LEGAL.privacyUrl)} style={{ color: t.c.inkSoft, textDecorationLine: 'underline', fontSize: 13 }}>
          Privacy Policy
        </Text>
      </View>
      <Disclaimer compact />
    </ScrollView>
  );
}
