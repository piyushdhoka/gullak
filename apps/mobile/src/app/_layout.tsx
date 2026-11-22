import '@/global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Landing } from '@/components/landing';
import { SignIn } from '@/components/sign-in';
import { DataProvider, useData } from '@/lib/data';
import { isStandalone } from '@/lib/push';
import { useClientValue } from '@/lib/use-client';
import { useAppFonts } from '@/ui/fonts';
import { useColors } from '@/ui/theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = useColors();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: c.groupedBackground, primary: c.tint } };
  const fontsLoaded = useAppFonts();

  useEffect(() => {
    // Service worker only handles push notifications (no offline caching, so updates are never stuck).
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Native waits for the fonts; the web renders straight away and swaps them in.
  if (!fontsLoaded && Platform.OS !== 'web') return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <DataProvider>
          <Gate />
        </DataProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Gate() {
  const { mode, ready, session, recovering } = useData();
  const c = useColors();
  const [signingIn, setSigningIn] = useState(false);
  // The installed Home Screen app skips the landing page.
  const standalone = useClientValue(isStandalone, false);
  const showLanding = Platform.OS === 'web' && !standalone;

  // Opened from a password-reset email: set the new password before anything else.
  if (mode === 'live' && recovering) return <SignIn recovering />;
  if (mode === 'live' && !session) {
    // Also rendered during static rendering and before the session is restored, so "/" has real content.
    if (showLanding && !signingIn) return <Landing onOpen={() => setSigningIn(true)} />;
    if (!ready) return <View style={{ flex: 1, backgroundColor: c.groupedBackground }} />;
    return <SignIn onBack={showLanding ? () => setSigningIn(false) : undefined} />;
  }
  if (!ready) return <View style={{ flex: 1, backgroundColor: c.groupedBackground }} />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.groupedBackground } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="transaction" />
      <Stack.Screen name="inbox" />
      <Stack.Screen name="review" />
    </Stack>
  );
}
