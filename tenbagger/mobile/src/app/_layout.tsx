import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useApp } from '../state/store';
import { useTheme } from '../theme';

function HeartsTicker() {
  const tick = useApp((s) => s.tickHearts);
  useEffect(() => {
    tick();
    const id = setInterval(() => tick(), 30_000);
    return () => clearInterval(id);
  }, [tick]);
  return null;
}

export default function RootLayout() {
  const t = useTheme();
  const base = t.dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: t.c.bg, card: t.c.surface, text: t.c.ink, border: t.c.line, primary: t.c.primary },
  };
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <HeartsTicker />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.c.bg },
            headerTintColor: t.c.ink,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: t.c.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="lesson/[id]" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="practice/[ticker]" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="company/[ticker]" options={{ title: '', headerBackTitle: 'Back' }} />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
