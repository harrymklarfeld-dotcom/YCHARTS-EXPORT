/**
 * Paywall. Rules: show the renewal price before checkout, trial terms in plain words, the
 * auto-renew disclosure Apple/Google require, Restore, and Terms/Privacy links. Never opened
 * mid-lesson (usePaywall refuses while a lesson is in progress).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Button, Disclaimer, Eyebrow, Title } from '../../components/ui';
import { FLAGS, LEGAL, PAYWALL_PLAN_ORDER, PLANS, PRO_BENEFITS, type PlanId } from '../../config/monetization';
import { useTheme } from '../../theme';
import { track } from '../analytics';
import { useEntitlement, usePlans, usePurchaseActions } from '../hooks';
import { autoRenewDisclosure, formatMoney, perMonth, planCardCopy, trialTerms } from '../pricing';
import { useMonetization } from '../store';
import type { StorePackage } from '../purchases/PurchasesAdapter';

function PlanCard({ pkg, monthly, selected, onPress }: { pkg: StorePackage; monthly?: StorePackage; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const plan = PLANS[pkg.planId];
  const copy = planCardCopy(pkg.price, monthly?.price);
  const highlight = !!plan.highlight;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${plan.label}, ${copy.headline}, ${copy.subline}${copy.badge ? `, ${copy.badge}` : ''}`}
      onPress={onPress}
      style={{
        borderRadius: t.radius.md,
        borderWidth: selected ? 2.5 : 1.5,
        borderColor: selected ? t.c.primary : t.c.line,
        backgroundColor: selected ? t.c.primarySoft : t.c.surface,
        padding: 14,
        paddingTop: highlight ? 18 : 14,
        gap: 4,
      }}
    >
      {highlight && copy.badge ? (
        <View style={{ position: 'absolute', top: -11, left: 14, backgroundColor: t.c.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 }}>{copy.badge.toUpperCase()}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: selected ? t.c.primary : t.c.locked,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: selected ? t.c.primary : 'transparent',
          }}
        >
          {selected ? <Icon name="check" size={14} color={t.c.primaryInk} strokeWidth={3} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 16 }}>{plan.label}</Text>
          <Text style={{ color: t.c.inkSoft, fontSize: 13 }}>{copy.subline}</Text>
        </View>
        <Text style={{ color: t.c.ink, fontWeight: '900', fontSize: 17, fontVariant: ['tabular-nums'] }}>{copy.headline}</Text>
      </View>
      {!highlight && copy.badge ? <Text style={{ color: t.c.accent, fontSize: 12, fontWeight: '800', marginLeft: 32 }}>{copy.badge}</Text> : null}
    </Pressable>
  );
}

function StudentCard({ pkg, selected, onPress }: { pkg: StorePackage; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const plan = PLANS.student_annual;
  const eq = formatMoney(perMonth(pkg.price.amount, pkg.price.period), pkg.price.currency);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Student plan, ${pkg.price.priceString} per year. ${plan.note ?? ''}`}
      onPress={onPress}
      style={{
        borderRadius: t.radius.md,
        borderWidth: selected ? 2.5 : 1,
        borderStyle: selected ? 'solid' : 'dashed',
        borderColor: selected ? t.c.primary : t.c.line,
        backgroundColor: selected ? t.c.primarySoft : 'transparent',
        padding: 14,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="book" size={18} color={t.c.ink} />
        <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 15, flex: 1 }}>Student? {pkg.price.priceString}/yr</Text>
        <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{eq}/mo</Text>
      </View>
      <Text style={{ color: t.c.inkSoft, fontSize: 12, lineHeight: 17 }}>{plan.note}</Text>
    </Pressable>
  );
}

export function PaywallScreen() {
  const t = useTheme();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const plans = usePlans();
  const { isPro, isTrial } = useEntitlement();
  const storeKind = useMonetization((s) => s.purchasesKind);
  const { purchase, restore, busy } = usePurchaseActions();
  const [selected, setSelected] = useState<PlanId>('pro_annual');
  const [message, setMessage] = useState<string | null>(null);
  const [justBought, setJustBought] = useState(false);

  const byId = useMemo(() => new Map(plans.map((p) => [p.planId, p])), [plans]);
  const monthly = byId.get('pro_monthly');
  const selectedPkg = byId.get(selected);

  useEffect(() => {
    track('paywall_view', { source: source ?? 'unknown', store: storeKind });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (!isPro) track('paywall_dismiss', { source: source ?? 'unknown' });
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const copy = selectedPkg ? planCardCopy(selectedPkg.price, monthly?.price) : null;
  const terms = selectedPkg ? trialTerms(selectedPkg.price) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.c.bg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingTop: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} hitSlop={12} style={{ padding: 8 }}>
          <Icon name="close" color={t.c.inkSoft} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 18 }}>
        <View style={{ gap: 8 }}>
          <Eyebrow color={t.c.accent}>Tenbagger Pro</Eyebrow>
          <Title size={28}>{isPro || justBought ? "You're Pro." : 'Read every number. No limits.'}</Title>
          <Text style={{ color: t.c.inkSoft, fontSize: 15, lineHeight: 22 }}>
            {isPro || justBought
              ? isTrial
                ? 'Your free trial is active. Everything below is unlocked.'
                : 'Everything below is unlocked. Thanks for supporting independent finance education.'
              : 'Free keeps the daily puzzle and a lesson a day. Pro unlocks the rest.'}
          </Text>
        </View>

        {isPro || justBought ? (
          <Button label="Start learning" onPress={close} />
        ) : (
          <>
            <View style={{ gap: 14, marginTop: 4 }} accessibilityRole="radiogroup">
              {PAYWALL_PLAN_ORDER.map((id) => {
                const pkg = byId.get(id);
                return pkg ? (
                  <PlanCard
                    key={id}
                    pkg={pkg}
                    monthly={monthly}
                    selected={selected === id}
                    onPress={() => {
                      setSelected(id);
                      track('plan_selected', { plan: id });
                    }}
                  />
                ) : null;
              })}
              {FLAGS.studentPlanEnabled && byId.get('student_annual') ? (
                <StudentCard
                  pkg={byId.get('student_annual')!}
                  selected={selected === 'student_annual'}
                  onPress={() => {
                    setSelected('student_annual');
                    track('plan_selected', { plan: 'student_annual' });
                  }}
                />
              ) : null}
            </View>

            <View style={{ gap: 8 }}>
              <Button
                label={busy === 'purchase' ? 'Processing…' : copy?.cta ?? 'Continue'}
                disabled={!!busy || !selectedPkg}
                onPress={async () => {
                  setMessage(null);
                  const r = await purchase(selected, source);
                  if (r.status === 'purchased') setJustBought(true);
                  else if (r.status === 'pending') setMessage('Your purchase is pending approval. Pro unlocks as soon as it goes through.');
                  else if (r.status === 'failed') setMessage(r.error ? `Purchase failed: ${r.error}` : 'Purchase failed. You have not been charged.');
                }}
              />
              {selectedPkg ? (
                <Text style={{ color: t.c.ink, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
                  {terms ?? `${copy?.headline}, renews automatically. Cancel anytime.`}
                </Text>
              ) : null}
              {selected === 'student_annual' ? (
                <Text style={{ color: t.c.inkSoft, fontSize: 12, textAlign: 'center' }}>
                  Student pricing is for students with a valid .edu email. We may ask you to verify it.
                </Text>
              ) : null}
              {message ? <Text style={{ color: t.c.danger, fontSize: 13, textAlign: 'center' }}>{message}</Text> : null}
            </View>
          </>
        )}

        <View style={{ gap: 12 }}>
          <Eyebrow>Everything in Pro</Eyebrow>
          {PRO_BENEFITS.map((b) => (
            <View key={b.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: t.c.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                <Icon name="check" size={15} color={t.c.primary} strokeWidth={3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 15 }}>{b.title}</Text>
                <Text style={{ color: t.c.inkSoft, fontSize: 13, lineHeight: 18 }}>{b.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            disabled={!!busy}
            onPress={async () => {
              setMessage(null);
              const snap = await restore();
              setMessage(snap.tier === 'pro' ? 'Purchases restored. Pro is active.' : 'No active subscription found for this account.');
            }}
          >
            <Text style={{ color: t.c.primary, fontWeight: '800', fontSize: 13 }}>{busy === 'restore' ? 'Restoring…' : 'Restore purchases'}</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(LEGAL.termsUrl)}>
            <Text style={{ color: t.c.inkSoft, fontWeight: '700', fontSize: 13, textDecorationLine: 'underline' }}>Terms of Use</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(LEGAL.privacyUrl)}>
            <Text style={{ color: t.c.inkSoft, fontWeight: '700', fontSize: 13, textDecorationLine: 'underline' }}>Privacy Policy</Text>
          </Pressable>
        </View>

        {storeKind === 'mock' ? (
          <View style={{ backgroundColor: t.c.accentSoft, borderRadius: t.radius.sm, padding: 10 }}>
            <Text style={{ color: t.c.ink, fontSize: 12, fontWeight: '700' }}>Test mode: purchases are simulated and nothing is charged.</Text>
          </View>
        ) : null}

        <Text style={{ color: t.c.inkSoft, fontSize: 11, lineHeight: 16 }}>{autoRenewDisclosure(Platform.OS)}</Text>
        <Disclaimer compact />
      </ScrollView>
    </SafeAreaView>
  );
}
