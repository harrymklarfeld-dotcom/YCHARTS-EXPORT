/** Shared onboarding frame: progress bar, big title, body, "why we ask", Back / Next / Skip. */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui';
import { useTheme } from '../../theme';
import { Meter, Why } from '../ui';

export function StepShell({
  progress,
  progressLabel,
  eyebrow,
  title,
  subtitle,
  why,
  children,
  nextLabel = 'Next',
  onNext,
  nextDisabled,
  onBack,
  onSkip,
  skipLabel = 'Skip',
  footer,
}: {
  progress: number;
  progressLabel: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  why?: string;
  children: ReactNode;
  nextLabel?: string;
  onNext: () => void;
  nextDisabled?: boolean;
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  footer?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.c.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, gap: 10, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 }}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={10}>
              <Text style={{ color: t.c.ink, fontSize: 22, fontWeight: '800' }}>‹</Text>
            </Pressable>
          ) : (
            <View style={{ width: 10 }} />
          )}
          <Meter value={progress} height={10} />
          {onSkip ? (
            <Pressable accessibilityRole="button" accessibilityLabel={skipLabel} onPress={onSkip} hitSlop={10}>
              <Text style={{ color: t.c.inkSoft, fontWeight: '800', fontSize: 14 }}>{skipLabel}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={{ color: t.c.inkSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>{progressLabel}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16, maxWidth: 640, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          {eyebrow ? <Text style={{ color: t.c.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' }}>{eyebrow}</Text> : null}
          <Text accessibilityRole="header" style={{ color: t.c.ink, fontFamily: t.fonts.display, fontSize: 28, fontWeight: '700', lineHeight: 34 }}>{title}</Text>
          {subtitle ? <Text style={{ color: t.c.inkSoft, fontSize: 15, lineHeight: 22 }}>{subtitle}</Text> : null}
        </View>
        {children}
        {why ? <Why>{why}</Why> : null}
        {footer}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 14, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        <Button label={nextLabel} onPress={onNext} disabled={nextDisabled} />
      </View>
    </KeyboardAvoidingView>
  );
}
