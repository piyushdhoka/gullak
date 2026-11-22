// In-app notification: when a push arrives while Gullak is on screen, the service worker sends it
// here instead of buzzing, and it drops in from the top as a tappable sticker, like Zomato's order
// updates. Tap the card to open what it's about, tap an action chip, or swipe it away with ×.
// It also powers the notification previews in Settings (showPushBanner).

import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isDemo } from '@/lib/api';
import { syncPush } from '@/lib/push';
import { Sticker } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

export interface BannerPush {
  title: string;
  body?: string;
  url?: string;
  kind?: string;
  actions?: { action: string; title: string; url?: string }[];
}

type Listener = (p: BannerPush) => void;
const listeners = new Set<Listener>();

/** Show a notification banner inside the app (used by the service worker bridge and by previews). */
export function showPushBanner(p: BannerPush) {
  listeners.forEach((l) => l(p));
}

const SHOW_MS = 6000;

export function PushBanner() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [push, setPush] = useState<BannerPush | null>(null);
  const [y] = useState(() => new Animated.Value(-220));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Signed in: make sure the server knows this device if notifications are already allowed.
  useEffect(() => {
    if (!isDemo) void syncPush();
  }, []);

  useEffect(() => {
    const onPush: Listener = (p) => setPush(p);
    listeners.add(onPush);
    // Web: pushes relayed by the service worker while the app is visible.
    const sw = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; payload?: BannerPush } | undefined;
      if (d?.type === 'push' && d.payload?.title) onPush(d.payload);
    };
    sw?.addEventListener('message', onMessage);
    return () => {
      listeners.delete(onPush);
      sw?.removeEventListener('message', onMessage);
    };
  }, []);

  useEffect(() => {
    if (!push) return;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) y.setValue(0);
        else Animated.spring(y, { toValue: 0, useNativeDriver: Platform.OS !== 'web', friction: 8, tension: 70 }).start();
        AccessibilityInfo.announceForAccessibility?.(`${push.title}. ${push.body ?? ''}`);
      });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => hide(), SHOW_MS);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [push]);

  function hide() {
    Animated.timing(y, { toValue: -220, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start(() => setPush(null));
  }

  function go(url?: string) {
    hide();
    if (url) router.push(url as Href);
  }

  if (!push) return null;
  const actions = (push.actions ?? []).slice(0, 2);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + 8, transform: [{ translateY: y }] }]}
      accessibilityLiveRegion="polite">
      <Pressable onPress={() => go(push.url)} accessibilityRole="button" accessibilityLabel={`${push.title}. ${push.body ?? ''}. Open`} style={styles.press}>
        {({ pressed }) => (
          <Sticker pressed={pressed} radius={18} style={styles.card} color={c.cardElevated}>
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: c.cream, borderColor: c.outline }]}>
                <Image source={require('../../assets/images/logo-192.png')} style={styles.mascot} contentFit="contain" />
              </View>
              <View style={styles.text}>
                <View style={styles.titleRow}>
                  <Text variant="caption1" weight="700" color="tint">
                    Gullak
                  </Text>
                  <Text variant="caption1" color="tertiaryLabel">
                    now
                  </Text>
                </View>
                <Text variant="subheadline" weight="700" numberOfLines={2}>
                  {push.title}
                </Text>
                {push.body ? (
                  <Text variant="footnote" color="secondaryLabel" numberOfLines={2}>
                    {push.body}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={hide} hitSlop={12} accessibilityRole="button" accessibilityLabel="Dismiss" style={styles.close}>
                <Text variant="footnote" weight="700" color="tertiaryLabel">
                  ✕
                </Text>
              </Pressable>
            </View>
            {actions.length ? (
              <View style={styles.actions}>
                {actions.map((a, i) => (
                  <Pressable
                    key={a.action}
                    onPress={() => go(a.url ?? push.url)}
                    accessibilityRole="button"
                    style={({ pressed: p }) => [
                      styles.chip,
                      i === 0
                        ? { backgroundColor: c.tint, borderColor: c.outline }
                        : { backgroundColor: 'transparent', borderColor: c.outline },
                      p && { opacity: 0.7 },
                    ]}>
                    <Text variant="footnote" weight="700" style={{ color: i === 0 ? c.onTint : c.label }}>
                      {a.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Sticker>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100, paddingHorizontal: 10 },
  press: { width: '100%', maxWidth: layout.maxWidth - 20 },
  card: { padding: 12, gap: 10 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatar: { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mascot: { width: 40, height: 40 },
  text: { flex: 1, minWidth: 0, gap: 1 },
  titleRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  close: { paddingHorizontal: 4, paddingTop: 2 },
  actions: { flexDirection: 'row', gap: 8, paddingLeft: 56 },
  chip: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
});
