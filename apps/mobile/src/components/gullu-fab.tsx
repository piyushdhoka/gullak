// Gullu, always one tap away: a round clay sticker with the mascot, floating at the bottom-right of the
// main tabs, just above the tab bar. Pressing drops it onto its shadow, like every other sticker.

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sticker } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

const SIZE = 60;
// The web tab bar is ours (layout.tabBarHeight); native tab bars are the system's (~49pt on iOS, ~80dp on Android).
const BAR = Platform.OS === 'web' ? layout.tabBarHeight : Platform.OS === 'ios' ? 49 : 80;

export function GulluFab() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    // Full-width, centred to the app's max width, so on wide screens it sits at the content's right edge.
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: BAR + insets.bottom + 14 }]}>
      <View pointerEvents="box-none" style={styles.inner}>
        <Pressable
          onPress={() => router.push('/ask')}
          accessibilityRole="button"
          accessibilityLabel="Ask Gullu about your money"
          hitSlop={6}>
          {({ pressed }) => (
            <Sticker color={c.tint} radius={SIZE / 2} lift={3} pressed={pressed} style={styles.fab}>
              <View style={[styles.face, { backgroundColor: c.cream, borderColor: c.outline }]}>
                <Image source={require('../../assets/images/logo-192.png')} style={styles.mascot} contentFit="contain" />
              </View>
              <View style={[styles.bubble, { backgroundColor: c.gold, borderColor: c.outline }]}>
                <Text pixel style={styles.bubbleText}>
                  ?
                </Text>
              </View>
            </Sticker>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 50 },
  inner: { width: '100%', maxWidth: layout.maxWidth, alignItems: 'flex-end', paddingRight: layout.inset },
  fab: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  face: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mascot: { width: 38, height: 38 },
  bubble: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleText: { fontSize: 14, lineHeight: 16, color: '#1C0F0C' },
});
