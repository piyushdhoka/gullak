import '@/global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Landing } from '@/components/landing';
import { PushBanner } from '@/components/push-banner';
import { SignIn } from '@/components/sign-in';
import { DataProvider, useData } from '@/lib/data';
import { isStandalone } from '@/lib/push';
import { useClientValue } from '@/lib/use-client';
import { useAppFonts } from '@/ui/fonts';
import { useColors, useScheme } from '@/ui/theme';

export default function RootLayout() {
  const scheme = useScheme();
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

/** Pages that work signed out (src/app/(site)). Rendered even before the session is restored. */
const PUBLIC = new Set(['/how-it-works', '/features', '/faq', '/install', '/sign-in', '/sign-up', '/forgot-password']);

/**
 * Routes
 *   Signed out:  /  (website home, in a browser tab)   /how-it-works  /features  /faq  /install
 *                /sign-in  /sign-up  /forgot-password
 *   Signed in:   /  /activity  /settings  /setup  /transaction  /review  /inbox  /add  /budgets
 *                /subscriptions  /jars  /jar  /ask
 * Each side is hidden from the other with Stack.Protected: signed-out visits to the app go to /sign-in,
 * signed-in visits to the public pages go home.
 */
function Gate() {
  const { mode, ready, session, recovering } = useData();
  const c = useColors();
  const pathname = usePathname();
  // The installed Home Screen app skips the website and opens on sign-in.
  const standalone = useClientValue(isStandalone, false);
  const signedIn = mode === 'demo' || !!session;

  // Opened from a password-reset email: set the new password before anything else.
  if (mode === 'live' && recovering) return <SignIn recovering />;
  // Website home. Also what static rendering produces for "/", so the page has real content.
  if (!signedIn && pathname === '/' && Platform.OS === 'web' && !standalone) return <Landing />;
  if (!ready && !PUBLIC.has(pathname)) return <View style={{ flex: 1, backgroundColor: c.groupedBackground }} />;

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.groupedBackground } }}>
        <Stack.Protected guard={signedIn} redirectTo="/sign-in">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="transaction" />
          <Stack.Screen name="inbox" />
          <Stack.Screen name="review" />
          <Stack.Screen name="add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="budgets" />
          <Stack.Screen name="subscriptions" />
          <Stack.Screen name="jars" />
          <Stack.Screen name="jar" />
          <Stack.Screen name="ask" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(site)" />
        </Stack.Protected>
      </Stack>
      {/* Notifications that arrive while the app is open drop in here instead of buzzing. */}
      {signedIn ? <PushBanner /> : null}
    </>
  );
}
