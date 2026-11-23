// "Break the Gullak": when a jar reaches its target, the clay pot cracks in two, coins spill out and a
// celebration line appears ("Goa trip saved! ₹30,000"). Plays once per jar (remembered on the device).
// Reanimated, transform/opacity only. With reduced motion the pot stays whole and the message just fades in.

import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { PotMeter } from '@/components/pot-meter';
import { hasBrokenJar, markJarBroken } from '@/lib/jar-break-seen';
import { Button } from '@/ui/controls';
import { Coin } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { useColors } from '@/ui/theme';

const POT = 200;
const POT_H = (POT * 31) / 24;
const COINS = 16;

/**
 * True once, at the moment a jar is full and its break hasn't been shown on this device.
 * `dismiss()` closes it. Never true for jars that aren't done.
 */
export function useJarBreak(jarId: string | undefined, done: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!jarId || !done) return;
    let live = true;
    hasBrokenJar(jarId).then((seen) => {
      if (!live || seen) return;
      setOpen(true);
      markJarBroken(jarId);
    });
    return () => {
      live = false;
    };
  }, [jarId, done]);
  return { open, dismiss: () => setOpen(false) };
}

function tap(kind: 'light' | 'success') {
  if (Platform.OS === 'web') return;
  try {
    if (kind === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Haptics are a nicety.
  }
}

// Fixed, hand-picked spread so every break looks good (angle in the upper half, a little speed variation).
const SPREAD = Array.from({ length: COINS }, (_, i) => {
  const a = Math.PI * (0.08 + (0.84 * i) / (COINS - 1));
  const speed = 0.7 + ((i * 37) % 10) / 20;
  return { dx: Math.cos(a) * 170 * speed * (i % 2 ? 1 : 0.8), up: 110 + Math.sin(a) * 130 * speed, fall: 150 + ((i * 53) % 90), spin: (i % 2 ? 1 : -1) * (180 + i * 20) };
});

function FlyingCoin({ p, i }: { p: { value: number }; i: number }) {
  const s = SPREAD[i];
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t === 0 ? 0 : interpolate(t, [0, 0.05, 0.7, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: s.dx * t },
        { translateY: interpolate(t, [0, 0.4, 1], [0, -s.up, s.fall]) },
        { rotate: `${s.spin * t}deg` },
        { scale: interpolate(t, [0, 0.15, 1], [0.4, 1.1, 1]) },
      ],
    };
  });
  return (
    <Animated.View style={[styles.coin, style]} pointerEvents="none">
      <Coin size={26} />
    </Animated.View>
  );
}

function Half({ side, t }: { side: 'left' | 'right'; t: { value: number } }) {
  const dir = side === 'left' ? -1 : 1;
  const style = useAnimatedStyle(() => {
    const b = t.value; // 0 whole, 1 broken apart
    const shake = interpolate(b, [0, 0.1, 0.2, 0.3, 0.4], [0, 1, -1, 1, 0], 'clamp');
    const apart = interpolate(b, [0.4, 1], [0, 1], 'clamp');
    return {
      opacity: interpolate(apart, [0, 0.7, 1], [1, 1, 0]),
      transform: [
        { translateX: dir * 70 * apart },
        { translateY: 200 * apart * apart },
        { rotate: `${shake * 2 + dir * 38 * apart}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[{ width: POT / 2, height: POT_H, overflow: 'hidden' }, style]}>
      <View style={{ marginLeft: side === 'left' ? 0 : -POT / 2 }}>
        <PotMeter progress={1} done size={POT} label={null} />
      </View>
    </Animated.View>
  );
}

export function JarBreak({ open, name, target, onClose }: { open: boolean; name: string; target: string; onClose: () => void }) {
  const c = useColors();
  const reduce = useReducedMotion();
  const fade = useSharedValue(0);
  const t = useSharedValue(0);
  const p = useSharedValue(0);
  const msg = useSharedValue(0);

  useEffect(() => {
    if (!open) return;
    fade.value = withTiming(1, { duration: 220 });
    if (reduce) {
      msg.value = withDelay(150, withTiming(1, { duration: 300 }));
      tap('success');
      return;
    }
    t.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
    p.value = withDelay(430, withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }));
    msg.value = withDelay(1100, withTiming(1, { duration: 400 }));
    const a = setTimeout(() => tap('light'), 120);
    const b = setTimeout(() => tap('success'), 450);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [open, reduce, fade, t, p, msg]);

  const backdrop = useAnimatedStyle(() => ({ opacity: fade.value }));
  const message = useAnimatedStyle(() => ({
    opacity: msg.value,
    transform: [{ translateY: interpolate(msg.value, [0, 1], [16, 0]) }],
  }));
  // Reduced motion: the whole pot just fades in; no cracking.
  const whole = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (!open) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { backgroundColor: 'rgba(20, 12, 9, 0.82)' }, backdrop]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={styles.center} accessibilityViewIsModal pointerEvents="box-none">
        <View style={styles.stage}>
          {reduce ? (
            <Animated.View style={whole}>
              <PotMeter progress={1} done size={POT} label={null} />
            </Animated.View>
          ) : (
            <>
              <View style={styles.pot}>
                <Half side="left" t={t} />
                <Half side="right" t={t} />
              </View>
              <View style={styles.coins} pointerEvents="none">
                {SPREAD.map((_, i) => (
                  <FlyingCoin key={i} p={p} i={i} />
                ))}
              </View>
            </>
          )}
        </View>
        <Animated.View style={[styles.message, message]} accessibilityLiveRegion="polite">
          <Text pixel style={[styles.headline, { color: '#FFF4E2' }]} align="center">
            {name} saved!
          </Text>
          <Text pixel style={[styles.amount, { color: c.gold }]} align="center">
            {target}
          </Text>
          <Text variant="subheadline" align="center" style={{ color: 'rgba(255, 244, 226, 0.8)' }}>
            Every coin is in. Time to enjoy it.
          </Text>
          <Button title="Nice!" onPress={onClose} style={styles.button} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 2 },
  stage: { width: POT, height: POT_H, alignItems: 'center', justifyContent: 'center' },
  pot: { flexDirection: 'row' },
  coins: { position: 'absolute', left: POT / 2 - 13, top: POT_H * 0.18 },
  coin: { position: 'absolute' },
  message: { marginTop: 36, alignItems: 'center', gap: 4, maxWidth: 360 },
  headline: { fontSize: 40, lineHeight: 46 },
  amount: { fontSize: 56, lineHeight: 64 },
  button: { marginTop: 18, minWidth: 180 },
});
