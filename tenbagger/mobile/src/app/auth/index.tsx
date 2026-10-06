// /auth: email → 6-digit code sign-in (no magic links), plus the 18+ check required before linking.
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { AUTH_COPY as C, isValidEmail, linkGate, useAuth } from '../../auth';
import { Checkbox, CodeField, ErrorLine, Field, LinkButton, SandboxBanner, leaveAuth } from '../../auth/components';
import { Body, Button, Title } from '../../components/ui';
import { useTheme } from '../../theme';

/** After the email step: two-step sign-in next if linking needs it (or a factor is waiting), else back. */
function proceed() {
  const s = useAuth.getState();
  if ((s.pendingAfterAuth === 'link' || s.status === 'mfa_required') && linkGate(s) === 'mfa') router.replace('/auth/mfa');
  else leaveAuth();
}

export default function AuthEmailScreen() {
  const t = useTheme();
  const status = useAuth((s) => s.status);
  const email = useAuth((s) => s.email);
  const pendingEmail = useAuth((s) => s.pendingEmail);
  const ageConfirmed = useAuth((s) => s.ageConfirmed);
  const sandbox = useAuth((s) => s.sandbox);
  const busy = useAuth((s) => s.busy);
  const error = useAuth((s) => s.error);
  const { init, sendCode, verifyCode, changeEmail, confirmAge, clearError } = useAuth.getState();
  const [emailInput, setEmailInput] = useState(pendingEmail ?? '');
  const [age, setAge] = useState(ageConfirmed);
  const [code, setCode] = useState('');

  useEffect(() => {
    void init();
    return () => clearError();
  }, [init, clearError]);

  const signedIn = status === 'signed_in' || status === 'mfa_required';
  const canSend = isValidEmail(emailInput) && age && !busy;

  const onSend = async () => {
    if (!canSend) return;
    setCode('');
    await sendCode(emailInput, age);
  };
  const onVerify = async () => {
    if (code.length !== 6 || busy) return;
    if (await verifyCode(code)) proceed();
  };

  return (
    <>
      <Stack.Screen options={{ title: sandbox ? C.sandboxLabel : 'Sign in', headerBackTitle: 'Back' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: t.c.bg }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48, maxWidth: 520, width: '100%', alignSelf: 'center' }}
      >
        {sandbox ? <SandboxBanner /> : null}

        {signedIn ? (
          <View style={{ gap: 14 }}>
            <Title size={24}>{C.signedInAs(email ?? '')}</Title>
            {!ageConfirmed ? <Checkbox checked={age} onChange={setAge} label={C.ageLabel} help={C.ageHelp} /> : null}
            <Button
              label={C.continue}
              disabled={!ageConfirmed && !age}
              onPress={async () => {
                if (!ageConfirmed) await confirmAge();
                proceed();
              }}
            />
          </View>
        ) : status === 'code_sent' && pendingEmail ? (
          <View style={{ gap: 14 }}>
            <Title size={24}>{C.codeTitle}</Title>
            <Body soft>{C.codeIntro(pendingEmail)}</Body>
            <CodeField label={C.codeLabel} value={code} onChange={setCode} onSubmit={onVerify} />
            <ErrorLine>{error}</ErrorLine>
            <Button label={busy ? 'Checking…' : C.verify} disabled={code.length !== 6 || busy} onPress={onVerify} />
            <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap' }}>
              <LinkButton label={C.resend} disabled={busy} onPress={() => void sendCode(pendingEmail, ageConfirmed)} />
              <LinkButton
                label={C.useDifferentEmail}
                disabled={busy}
                onPress={() => {
                  setCode('');
                  changeEmail();
                }}
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <Title size={24}>{C.emailTitle}</Title>
            <Body soft>{C.emailIntro}</Body>
            <Field
              label={C.emailLabel}
              value={emailInput}
              onChangeText={setEmailInput}
              placeholder={C.emailPlaceholder}
              keyboardType="email-address"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              onSubmitEditing={onSend}
            />
            <Checkbox checked={age} onChange={setAge} label={C.ageLabel} help={C.ageHelp} />
            <ErrorLine>{error}</ErrorLine>
            <Button label={busy ? 'Sending…' : C.sendCode} disabled={!canSend} onPress={onSend} />
          </View>
        )}

        {Platform.OS === 'web' && !sandbox ? <Text style={{ color: t.c.inkSoft, fontSize: 12 }}>{C.webNote}</Text> : null}
      </ScrollView>
    </>
  );
}
