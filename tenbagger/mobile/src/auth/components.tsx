/** Small building blocks for the sign-in screens (theme-aware, accessible). */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Icon } from '../components/Icon';
import { useTheme } from '../theme';
import { AUTH_COPY } from './copy';

export function Field({ label, ...rest }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 13 }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.c.inkSoft}
        {...rest}
        style={{ borderWidth: 1.5, borderColor: t.c.line, borderRadius: t.radius.md, paddingHorizontal: 14, paddingVertical: 12, color: t.c.ink, backgroundColor: t.c.surface, fontSize: 17 }}
      />
    </View>
  );
}

export function CodeField({ label, value, onChange, onSubmit }: { label: string; value: string; onChange: (v: string) => void; onSubmit?: () => void }) {
  return (
    <Field
      label={label}
      value={value}
      onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))}
      keyboardType="number-pad"
      inputMode="numeric"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="123 456"
      onSubmitEditing={onSubmit}
      returnKeyType="done"
    />
  );
}

export function Checkbox({ checked, onChange, label, help }: { checked: boolean; onChange: (v: boolean) => void; label: string; help?: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: checked ? t.c.primary : t.c.line,
          backgroundColor: checked ? t.c.primary : t.c.surface,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {checked ? <Icon name="check" color={t.c.primaryInk} size={14} strokeWidth={3} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: t.c.ink, fontWeight: '800', fontSize: 15 }}>{label}</Text>
        {help ? <Text style={{ color: t.c.inkSoft, fontSize: 12, lineHeight: 17 }}>{help}</Text> : null}
      </View>
    </Pressable>
  );
}

export function SandboxBanner() {
  const t = useTheme();
  return (
    <View accessibilityRole="text" style={{ backgroundColor: t.c.accentSoft, borderRadius: t.radius.md, paddingVertical: 8, paddingHorizontal: 12, gap: 2 }}>
      <Text style={{ color: t.c.ink, fontSize: 13, fontWeight: '800' }}>{AUTH_COPY.sandboxLabel}</Text>
      <Text style={{ color: t.c.ink, fontSize: 12 }}>{AUTH_COPY.sandboxNote}</Text>
    </View>
  );
}

export function ErrorLine({ children }: { children: ReactNode }) {
  const t = useTheme();
  if (!children) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={{ color: t.c.danger, fontSize: 13, lineHeight: 18 }}>
      {children}
    </Text>
  );
}

export function LinkButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={8} style={{ paddingVertical: 6, alignSelf: 'flex-start', opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color: t.c.primary, fontWeight: '800', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Leave the auth flow: back to where the user came from (Home if opened directly). */
export function leaveAuth() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
