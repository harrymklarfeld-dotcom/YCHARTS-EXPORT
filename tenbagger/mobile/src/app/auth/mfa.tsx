// /auth/mfa: set up or enter an authenticator (TOTP) code to reach an aal2 session, needed to link accounts.
// No QR library is installed: the setup key is shown as text plus an otpauth:// link.
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';
import { AUTH_COPY as C, groupSetupKey, useAuth } from '../../auth';
import { CodeField, ErrorLine, LinkButton, SandboxBanner, leaveAuth } from '../../auth/components';
import { Icon } from '../../components/Icon';
import { Body, Button, Card, Eyebrow, Title } from '../../components/ui';
import { useTheme } from '../../theme';

export default function MfaScreen() {
  const t = useTheme();
  const status = useAuth((s) => s.status);
  const ready = useAuth((s) => s.ready);
  const aal = useAuth((s) => s.aal);
  const mfaEnrolled = useAuth((s) => s.mfaEnrolled);
  const enrollment = useAuth((s) => s.enrollment);
  const sandbox = useAuth((s) => s.sandbox);
  const busy = useAuth((s) => s.busy);
  const error = useAuth((s) => s.error);
  const { init, loadFactors, startEnroll, verifyMfa, clearError } = useAuth.getState();
  const [code, setCode] = useState('');

  useEffect(() => {
    void init().then(() => {
      if (useAuth.getState().status !== 'signed_out') void loadFactors();
    });
    return () => clearError();
  }, [init, loadFactors, clearError]);

  useEffect(() => {
    if (ready && (status === 'signed_out' || status === 'code_sent')) router.replace('/auth');
  }, [ready, status]);

  // No authenticator yet: start enrollment so the setup key is ready to copy.
  useEffect(() => {
    if (ready && aal === 'aal1' && mfaEnrolled === false && !enrollment && !busy && !error) void startEnroll();
  }, [ready, aal, mfaEnrolled, enrollment, busy, error, startEnroll]);

  const onVerify = async () => {
    if (code.length !== 6 || busy) return;
    if (await verifyMfa(code)) leaveAuth();
  };

  const done = aal === 'aal2';

  return (
    <>
      <Stack.Screen options={{ title: C.mfaTitle, headerBackTitle: 'Back' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: t.c.bg }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48, maxWidth: 560, width: '100%', alignSelf: 'center' }}
      >
        {sandbox ? <SandboxBanner /> : null}
        <Title size={24}>{C.mfaTitle}</Title>
        <View style={{ flexDirection: 'row', gap: 10, backgroundColor: t.c.primarySoft, borderRadius: t.radius.md, padding: 12 }}>
          <Icon name="lock" color={t.c.primary} size={18} />
          <Text style={{ flex: 1, color: t.c.ink, fontSize: 13, lineHeight: 19 }}>{C.mfaWhy}</Text>
        </View>

        {done ? (
          <View style={{ gap: 14 }}>
            <Body weight="800">{C.mfaDone}</Body>
            <Button label={C.continue} onPress={leaveAuth} />
          </View>
        ) : enrollment ? (
          <View style={{ gap: 14 }}>
            <Card style={{ gap: 10 }}>
              {C.mfaEnrollSteps.map((step, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                  <Text style={{ color: t.c.primary, fontWeight: '900', fontSize: 14, width: 18 }}>{i + 1}.</Text>
                  <Text style={{ flex: 1, color: t.c.ink, fontSize: 14, lineHeight: 20 }}>{step}</Text>
                </View>
              ))}
            </Card>
            <View style={{ gap: 6 }}>
              <Eyebrow>{C.mfaKeyLabel}</Eyebrow>
              <Text
                selectable
                accessibilityLabel={`${C.mfaKeyLabel}: ${enrollment.secret.split('').join(' ')}`}
                style={{
                  color: t.c.ink,
                  fontSize: 20,
                  fontWeight: '800',
                  letterSpacing: 1.5,
                  fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
                  backgroundColor: t.c.surface,
                  borderWidth: 1,
                  borderColor: t.c.line,
                  borderRadius: t.radius.md,
                  padding: 12,
                }}
              >
                {groupSetupKey(enrollment.secret)}
              </Text>
            </View>
            <View style={{ gap: 6 }}>
              <Eyebrow>{C.mfaLinkLabel}</Eyebrow>
              <Text selectable style={{ color: t.c.inkSoft, fontSize: 12, lineHeight: 17 }}>
                {enrollment.uri}
              </Text>
              {Platform.OS !== 'web' ? <LinkButton label={C.mfaOpenLink} onPress={() => void Linking.openURL(enrollment.uri).catch(() => undefined)} /> : null}
            </View>
            <CodeField label={C.mfaCodeLabel} value={code} onChange={setCode} onSubmit={onVerify} />
            <ErrorLine>{error}</ErrorLine>
            <Button label={busy ? 'Checking…' : C.mfaVerify} disabled={code.length !== 6 || busy} onPress={onVerify} />
            <LinkButton
              label={C.mfaStartOver}
              disabled={busy}
              onPress={() => {
                setCode('');
                void startEnroll();
              }}
            />
          </View>
        ) : mfaEnrolled ? (
          <View style={{ gap: 14 }}>
            <Body soft>{C.mfaVerifyIntro}</Body>
            <CodeField label={C.mfaCodeLabel} value={code} onChange={setCode} onSubmit={onVerify} />
            <ErrorLine>{error}</ErrorLine>
            <Button label={busy ? 'Checking…' : C.mfaVerify} disabled={code.length !== 6 || busy} onPress={onVerify} />
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <ErrorLine>{error}</ErrorLine>
            {error ? (
              <Button
                label={C.mfaStartOver}
                onPress={() => {
                  clearError();
                  void startEnroll();
                }}
              />
            ) : (
              <Body soft>Getting your setup key…</Body>
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}
