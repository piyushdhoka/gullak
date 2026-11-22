// Public pages for signed-out visitors: the website (web only) and the sign-in screens (all platforms).
// The root layout hides this whole group once someone is signed in.
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

// The app has no website home, so signed-out phones start on Sign in (else the router picks the first file, /faq).
export const unstable_settings = Platform.OS === 'web' ? {} : { anchor: 'sign-in' };

export default function SiteLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'none' }} />;
}
