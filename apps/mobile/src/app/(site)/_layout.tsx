// Public pages for signed-out visitors: the website (web only) and the sign-in screens (all platforms).
// The root layout hides this whole group once someone is signed in.
import { Stack } from 'expo-router';

export default function SiteLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'none' }} />;
}
