/**
 * Connections: every linked bank, card and brokerage, with status, freshness, refresh and unlink.
 * Read-only: nothing here can move money. No XP or rewards for linking or refreshing.
 * Copy lives in ./copy.ts (scanned for banned phrases in __tests__/live.test.ts).
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { gateRoute, linkGate, selectLinkGate, useAuth } from '../../auth';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { Button, Card } from '../../components/ui';
import { useTheme } from '../../theme';
import { getMoneyClient } from './config';
import { CONNECTIONS_COPY as C } from './copy';
import { agoText, canSync, cooldownRemaining, statusChip, type ChipTone } from './freshness';
import { useNow } from './hooks';
import { MOCK_INSTITUTIONS } from './mockFixtures';
import { useConnections } from './store';
import type { Connection } from './types';

export default function ConnectionsScreen() {
  const t = useTheme();
  const connections = useConnections((s) => s.connections);
  const refreshing = useConnections((s) => s.refreshing);
  const lastAttempt = useConnections((s) => s.lastAttempt);
  const loading = useConnections((s) => s.loading);
  const initialized = useConnections((s) => s.initialized);
  const { init, link, refresh, unlink, signInAgain } = useConnections.getState();
  const mode = getMoneyClient().mode;
  const now = useNow(30_000);
  const [picker, setPicker] = useState(false);
  const [confirm, setConfirm] = useState<Connection | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!initialized) void init();
  }, [initialized, init]);

  const run = async (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true);
    setMessage(null);
    const r = await fn();
    setBusy(false);
    if (r.message) setMessage(r.message);
  };

  // Linking needs a signed-in, 18+, two-step (aal2) session. Sign-in first, then linking resumes here.
  const gate = useAuth(selectLinkGate);
  const authEmail = useAuth((s) => s.email);
  const ensureLinkReady = (resume: boolean): boolean => {
    const g = linkGate(useAuth.getState());
    const route = gateRoute(g);
    if (!route) return true;
    useAuth.getState().setPendingAfterAuth(resume ? 'link' : null);
    router.push(route);
    return false;
  };
  const startLink = () => {
    if (mode === 'mock') setPicker(true);
    else void run(() => link());
  };
  const onLink = () => {
    if (ensureLinkReady(true)) startLink();
  };
  const startLinkRef = useRef(startLink);
  startLinkRef.current = startLink;
  useFocusEffect(
    useCallback(() => {
      const a = useAuth.getState();
      if (a.pendingAfterAuth !== 'link') return;
      a.setPendingAfterAuth(null); // backing out of sign-in also clears it
      if (gate === 'ok') startLinkRef.current();
    }, [gate]),
  );
  // Signed in or out (real mode): reload connections for the new session.
  const lastEmail = useRef(authEmail);
  useEffect(() => {
    if (lastEmail.current === authEmail) return;
    lastEmail.current = authEmail;
    if (initialized && authEmail) void useConnections.getState().reload();
  }, [authEmail, initialized]);
  const linkedIds = new Set(connections.map((c) => c.institutionId));
  const anySample = mode === 'mock' || connections.some((c) => c.sample);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      <Text style={{ color: t.c.inkSoft, fontSize: 14, lineHeight: 20 }}>{C.intro}</Text>

      <View accessibilityRole="text" style={{ flexDirection: 'row', gap: 10, backgroundColor: t.c.primarySoft, borderRadius: t.radius.md, padding: 12 }}>
        <Icon name="lock" color={t.c.primary} size={18} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 13 }}>{C.readOnlyTitle}</Text>
          <Text style={{ color: t.c.ink, fontSize: 12, lineHeight: 17 }}>{C.readOnly}</Text>
        </View>
      </View>

      {anySample ? (
        <View style={{ backgroundColor: t.c.accentSoft, borderRadius: t.radius.md, paddingVertical: 8, paddingHorizontal: 12 }}>
          <Text style={{ color: t.c.ink, fontSize: 12 }}>{C.sandboxNote}</Text>
        </View>
      ) : null}

      {loading && connections.length === 0 ? <ActivityIndicator color={t.c.primary} /> : null}
      {!loading && connections.length === 0 ? <Text style={{ color: t.c.inkSoft, fontSize: 14 }}>{C.empty}</Text> : null}

      {connections.map((c) => (
        <ConnectionCard
          key={c.id}
          c={c}
          now={now}
          updating={!!refreshing[c.id]}
          cooling={cooldownRemaining(lastAttempt[c.id], now) > 0}
          disabled={busy}
          onRefresh={() => void run(() => refresh([c.id]))}
          onSignIn={() => {
            if (ensureLinkReady(false)) void run(() => signInAgain(c.id));
          }}
          onUnlink={() => setConfirm(c)}
        />
      ))}

      {message ? (
        <Text accessibilityLiveRegion="polite" style={{ color: t.c.inkSoft, fontSize: 13 }}>
          {message}
        </Text>
      ) : null}

      <Button label={connections.length ? C.linkAnother : C.linkFirst} icon={<Icon name="plus" color={t.c.primaryInk} size={18} />} onPress={onLink} disabled={busy} />

      <Sheet visible={picker} onClose={() => setPicker(false)} title={C.pickerTitle}>
        <Text style={{ color: t.c.inkSoft, fontSize: 13, marginBottom: 10 }}>{C.pickerNote}</Text>
        {MOCK_INSTITUTIONS.map((inst) => {
          const already = linkedIds.has(inst.id);
          return (
            <Pressable
              key={inst.id}
              accessibilityRole="button"
              accessibilityLabel={`${inst.name}, ${inst.kind}${already ? ', already linked' : ''}`}
              accessibilityState={{ disabled: already }}
              disabled={already || busy}
              onPress={() => {
                setPicker(false);
                void run(() => link(inst.id));
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.c.line, opacity: already ? 0.5 : pressed ? 0.6 : 1 })}
            >
              <Icon name="building" color={t.c.ink} size={20} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 15 }}>{inst.name}</Text>
                <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{already ? 'Already linked' : inst.kind}</Text>
              </View>
              {!already ? <Icon name="chevron" color={t.c.inkSoft} size={14} /> : null}
            </Pressable>
          );
        })}
      </Sheet>

      <Sheet visible={!!confirm} onClose={() => setConfirm(null)} title={C.unlinkTitle}>
        <View style={{ gap: 12 }}>
          <Text style={{ color: t.c.ink, fontSize: 14, lineHeight: 20 }}>
            <Text style={{ fontWeight: '800' }}>{confirm?.institution}. </Text>
            {C.unlinkBody}
          </Text>
          <Button
            label={C.unlinkConfirm}
            variant="danger"
            onPress={() => {
              const c = confirm;
              setConfirm(null);
              if (c) void run(() => unlink(c.id));
            }}
          />
          <Button label={C.cancel} variant="secondary" onPress={() => setConfirm(null)} />
        </View>
      </Sheet>
    </ScrollView>
  );
}

function ConnectionCard({
  c,
  now,
  updating,
  cooling,
  disabled,
  onRefresh,
  onSignIn,
  onUnlink,
}: {
  c: Connection;
  now: number;
  updating: boolean;
  cooling: boolean;
  disabled: boolean;
  onRefresh: () => void;
  onSignIn: () => void;
  onUnlink: () => void;
}) {
  const t = useTheme();
  const chip = statusChip(c, updating);
  const tone: Record<ChipTone, { bg: string; fg: string }> = {
    ok: { bg: t.c.primarySoft, fg: t.c.primary },
    busy: { bg: t.c.surfaceAlt, fg: t.c.ink },
    attention: { bg: t.c.accentSoft, fg: t.c.accent },
    muted: { bg: t.c.surfaceAlt, fg: t.c.inkSoft },
  };
  const help = c.status === 'needs_relogin' ? C.needsReloginHelp : c.status === 'expiring' ? C.expiringHelp : c.status === 'error' ? C.errorHelp : null;
  const updated = `${C.updated} ${agoText(c.lastSyncedAt, now)}`;
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name="building" color={t.c.ink} size={22} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 16 }}>{c.institution}</Text>
          <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>
            {C.accounts(c.accountsCount)} · {updated}
          </Text>
        </View>
        <View accessibilityLabel={`Status: ${chip.label}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: tone[chip.tone].bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
          {updating ? <ActivityIndicator size="small" color={tone[chip.tone].fg} /> : null}
          <Text style={{ color: tone[chip.tone].fg, fontSize: 11, fontWeight: '800' }}>{chip.label}</Text>
        </View>
      </View>
      {help ? <Text style={{ color: t.c.inkSoft, fontSize: 12, lineHeight: 17 }}>{help}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {c.status === 'needs_relogin' || c.status === 'expiring' ? (
          <SmallButton label={C.signInAgain} primary onPress={onSignIn} disabled={disabled || updating} a11y={`${C.signInAgain} to ${c.institution}`} />
        ) : null}
        {canSync(c) ? (
          <SmallButton
            label={C.refresh}
            onPress={onRefresh}
            disabled={disabled || updating}
            a11y={`${C.refresh} ${c.institution}${cooling ? `. ${C.refreshCooling}` : ''}`}
          />
        ) : null}
        <SmallButton label={C.unlink} onPress={onUnlink} disabled={disabled} a11y={`${C.unlink} ${c.institution}`} />
      </View>
    </Card>
  );
}

function SmallButton({ label, onPress, disabled, primary, a11y }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean; a11y: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: t.radius.pill,
        borderWidth: 1,
        borderColor: primary ? t.c.primary : t.c.line,
        backgroundColor: primary ? t.c.primary : t.c.surface,
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: primary ? t.c.primaryInk : t.c.ink, fontWeight: '800', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
