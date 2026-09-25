/**
 * <ProGate feature="xray">…Pro content…</ProGate>
 * Renders children when allowed; otherwise a lock card that opens the paywall on tap.
 * Never place it inside the lesson player's question flow.
 */
import { useEffect, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import type { Feature } from '../../config/monetization';
import { useTheme } from '../../theme';
import { track } from '../analytics';
import { useFeature } from '../hooks';

const COPY: Partial<Record<Feature, { title: string; body: string }>> = {
  lessons: { title: "You've finished today's free lesson", body: 'Come back tomorrow, or go unlimited with Pro.' },
  practice_mode: { title: 'Practice mode is Pro', body: 'Drill this company with questions built from its filings.' },
  screener_presets_all: { title: 'This screen is Pro', body: 'Unlock every preset screen.' },
  saved_screens: { title: 'Saved screens are full', body: 'Free keeps 3 saved screens. Pro keeps them all.' },
  xray: { title: 'Fund X-ray is Pro', body: 'See what a fund really owns, weighted by position.' },
  compare: { title: 'Compare is Pro', body: 'Chart companies side by side over 10 years.' },
  money_accounts: { title: 'Free links 1 account', body: 'Link every bank and card with Pro.' },
  money_alerts: { title: 'Alerts are Pro', body: 'Get a heads-up before a bill is due.' },
  personal_10k: { title: 'Your personal 10-K is Pro', body: 'Your year, read like an annual report.' },
  articles_pro: { title: 'This article is Pro', body: 'Deep dives are part of Pro.' },
};

export function ProLockCard({ feature, title, body, onPress, compact }: { feature: Feature; title?: string; body?: string; onPress: () => void; compact?: boolean }) {
  const t = useTheme();
  const c = COPY[feature];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title ?? c?.title ?? 'Pro feature'}. Unlock with Pro`}
      onPress={onPress}
      style={{ backgroundColor: t.c.surface, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.c.accent, padding: compact ? 12 : 16, gap: 8 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="lock" color={t.c.accent} size={18} />
        <Text style={{ color: t.c.accent, fontWeight: '900', fontSize: 11, letterSpacing: 1 }}>PRO</Text>
      </View>
      <Text style={{ color: t.c.ink, fontFamily: t.fonts.display, fontSize: compact ? 16 : 18, fontWeight: '700' }}>{title ?? c?.title ?? 'Unlock with Pro'}</Text>
      {!compact ? <Text style={{ color: t.c.inkSoft, fontSize: 13, lineHeight: 19 }}>{body ?? c?.body ?? ''}</Text> : null}
      <Text style={{ color: t.c.primary, fontWeight: '800', fontSize: 14 }}>See Pro plans ›</Text>
    </Pressable>
  );
}

export function ProGate({
  feature,
  children,
  fallback,
  title,
  body,
  compact,
}: {
  feature: Feature;
  children: ReactNode;
  /** Custom locked UI; receives nothing, call useFeature().openPaywall yourself. */
  fallback?: ReactNode;
  title?: string;
  body?: string;
  compact?: boolean;
}) {
  const gate = useFeature(feature);
  useEffect(() => {
    if (!gate.allowed) track('gate_hit', { feature, reason: gate.reason, shown: 'lock_card' });
  }, [gate.allowed, gate.reason, feature]);
  if (gate.allowed) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return <ProLockCard feature={feature} title={title} body={body} compact={compact} onPress={() => gate.openPaywall()} />;
}
