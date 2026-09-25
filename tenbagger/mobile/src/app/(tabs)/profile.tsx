import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Body, Card, Chip, Disclaimer, Eyebrow, ProgressBar, Title } from '../../components/ui';
import { dataInfo } from '../../data';
import { DAILY_GOAL_OPTIONS, displayedStreak, levelForXp } from '../../game';
import { useEntitlement, usePurchaseActions } from '../../monetization';
import { today, useApp, type ThemePref } from '../../state/store';
import { useTheme } from '../../theme';

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  const t = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, backgroundColor: t.c.surface, borderRadius: t.radius.md, padding: 12, borderWidth: 1, borderColor: t.c.line, gap: 2 }}>
      <Text style={{ fontSize: 22, fontWeight: '900', color, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ fontSize: 12, color: t.c.inkSoft, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function Row({ icon, label, detail, onPress, disabled, badge }: { icon: Parameters<typeof Icon>[0]['name']; label: string; detail?: string; onPress?: () => void; disabled?: boolean; badge?: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${badge ? `, ${badge}` : ''}`}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}
    >
      <Icon name={icon} color={disabled ? t.c.locked : t.c.ink} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: disabled ? t.c.inkSoft : t.c.ink, fontWeight: '700', fontSize: 15 }}>{label}</Text>
        {detail ? <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{detail}</Text> : null}
      </View>
      {badge ? (
        <View style={{ backgroundColor: t.c.accentSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: t.c.ink }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const t = useTheme();
  const s = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const ent = useEntitlement();
  const { restore, busy } = usePurchaseActions();
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const lvl = levelForXp(s.totalXp);
  const streak = displayedStreak(s.streak, today());
  const lessonsDone = Object.keys(s.completed).length;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.c.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: t.c.primaryInk, fontFamily: t.fonts.display, fontSize: 26, fontWeight: '700' }}>L{lvl.level}</Text>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Title size={24}>Your progress</Title>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ProgressBar value={lvl.intoLevel / lvl.levelSize} color={t.c.accent} height={10} label={`Level ${lvl.level} progress`} />
              <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '700' }}>
                {lvl.intoLevel}/{lvl.levelSize}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Stat label="Day streak" value={streak} color={t.c.flame} />
          <Stat label="Best streak" value={s.streak.longest} color={t.c.flame} />
          <Stat label="Total XP" value={s.totalXp} color={t.c.accent} />
          <Stat label="Lessons" value={lessonsDone} color={t.c.primary} />
        </View>

        <Card style={{ gap: 6, backgroundColor: t.c.ink, borderColor: t.c.ink }}>
          <Eyebrow color={t.c.accent}>Leagues · coming soon</Eyebrow>
          <Text style={{ color: t.c.bg, fontFamily: t.fonts.display, fontSize: 18, fontWeight: '700' }}>Weekly learning leagues</Text>
          <Text style={{ color: t.c.bg, opacity: 0.8, fontSize: 13, lineHeight: 19 }}>
            Compete on lesson XP with learners at your level. Rankings will only ever count learning — never trading or portfolio returns.
          </Text>
        </Card>

        <View style={{ gap: 10 }}>
          <Eyebrow>Daily goal</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {DAILY_GOAL_OPTIONS.map((g) => (
              <Chip key={g} label={`${g} XP`} selected={s.dailyGoal === g} onPress={() => s.setDailyGoal(g)} accessibilityLabel={`Daily goal ${g} XP`} />
            ))}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Eyebrow>Appearance</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['system', 'light', 'dark'] as ThemePref[]).map((p) => (
              <Chip key={p} label={p[0].toUpperCase() + p.slice(1)} selected={s.themePref === p} onPress={() => s.setThemePref(p)} accessibilityLabel={`Theme ${p}`} />
            ))}
          </View>
        </View>

        <Card style={{ paddingVertical: 4 }}>
          <Row
            icon="star"
            label={ent.isPro ? (ent.isTrial ? 'Tenbagger Pro (trial)' : 'Tenbagger Pro') : 'Upgrade to Pro'}
            detail={ent.isPro ? 'Manage your subscription' : 'Unlimited lessons, every screen, no ads'}
            badge={ent.isPro ? 'Active' : undefined}
            onPress={() => router.push('/settings/subscription')}
          />
          <View style={{ height: 1, backgroundColor: t.c.line }} />
          <Row
            icon="check"
            label={busy === 'restore' ? 'Restoring…' : 'Restore purchases'}
            detail={restoreMsg ?? 'Already subscribed on this store account?'}
            disabled={!!busy}
            onPress={async () => {
              const snap = await restore();
              setRestoreMsg(snap.tier === 'pro' ? 'Restored. Pro is active.' : 'No active subscription found.');
            }}
          />
          <View style={{ height: 1, backgroundColor: t.c.line }} />
          <Row icon="link" label="Link brokerage" detail="See your own holdings next to lessons" disabled badge="Coming soon" />
          <View style={{ height: 1, backgroundColor: t.c.line }} />
          <Row icon="book" label="Data source" detail={`${dataInfo.companiesSource}${dataInfo.isSample ? ' (sample numbers)' : ''} · SEC EDGAR filings`} disabled />
          <View style={{ height: 1, backgroundColor: t.c.line }} />
          <Row
            icon="trash"
            label={confirmReset ? 'Tap again to erase all progress' : 'Reset progress'}
            detail="Clears XP, streak, hearts and lessons on this device"
            onPress={() => {
              if (confirmReset) {
                s.resetProgress();
                setConfirmReset(false);
              } else setConfirmReset(true);
            }}
          />
        </Card>
        <Body soft size={12}>
          Tenbagger teaches you to read company financials. It does not recommend buying, selling or holding any security.
        </Body>
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.c.line, backgroundColor: t.c.bg }}>
        <Disclaimer />
      </View>
    </SafeAreaView>
  );
}
