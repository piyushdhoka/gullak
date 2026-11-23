// Gullu, Gullak's chatbot: chat with your own spending data. The server function runs the AI with our stats tools.

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { friendly, isDemo, supabase } from '@/lib/api';
import { clearChat, contextForServer, loadChat, saveChat, type ChatMessage } from '@/lib/chat-history';
import { confirm } from '@/lib/confirm';
import { useKeyboard } from '@/lib/keyboard';
import { useData } from '@/lib/data';
import { BackChevron } from '@/ui/icons';
import { Sticker } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { fontFamily, layout, type, useColors } from '@/ui/theme';

type Message = ChatMessage;

const SUGGESTIONS = [
  'How much did I spend on chai this month?',
  'What did I spend on food last month?',
  'Which subscriptions am I paying for?',
  'Am I on track for my jars?',
  'What were my 3 biggest payments this month?',
];

const TOOL_LABEL: Record<string, string> = {
  spending: 'payments',
  month_summary: 'month summary',
  trend: 'monthly trend',
  subscriptions: 'subscriptions',
  budgets: 'budgets',
  jars: 'jars',
  biggest_payments: 'biggest payments',
};

const MASCOT = require('../../assets/images/logo-192.png');

function Avatar({ size = 30 }: { size?: number }) {
  const c = useColors();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: c.cream, borderColor: c.outline }]}>
      <Image source={MASCOT} style={{ width: size - 4, height: size - 4 }} contentFit="contain" />
    </View>
  );
}

/** Three coins bobbing while Gullu thinks. Still dots when reduce-motion is on. */
function Thinking() {
  const c = useColors();
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce) return;
        loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== 'web' }));
        loop.start();
      });
    return () => loop?.stop();
  }, [t]);
  return (
    <View style={styles.row} accessibilityLabel="Gullu is counting coins" accessibilityLiveRegion="polite">
      <Avatar />
      <Sticker radius={16} lift={2} style={styles.thinkingBubble}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: c.gold, borderColor: c.outline },
                {
                  transform: [
                    {
                      translateY: t.interpolate({
                        inputRange: [0, (i + 0.5) / 4, (i + 1) / 4, 1],
                        outputRange: [0, -5, 0, 0],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
        <Text variant="footnote" color="secondaryLabel">
          Counting coins…
        </Text>
      </Sticker>
    </View>
  );
}

export default function AskScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  // The input sits directly on the keyboard. Native: the keyboard's height lifts the screen. Web: the screen is fitted
  // to the visible area above the keyboard (see lib/keyboard.ts). The home-indicator inset is dropped while it's open.
  const keyboard = useKeyboard();
  const keyboardOpen = keyboard.height > 0 || keyboard.viewport !== null;
  const screenStyle = keyboard.viewport
    ? { height: keyboard.viewport.height, transform: [{ translateY: keyboard.viewport.top }] }
    : { flex: 1, paddingBottom: keyboard.height };
  const { session } = useData();
  const userId = isDemo ? null : (session?.userId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  // Saving waits until the saved chat has been loaded, so an empty screen never overwrites it.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);

  // Load the last 24 hours of chat for this user (kept on this device only).
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    loadChat(AsyncStorage, userId).then((saved) => {
      if (!alive) return;
      setMessages(saved);
      setLoadedFor(userId);
      if (saved.length) setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 50);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  // Save after every change. Error bubbles and anything older than 24 hours are left out.
  useEffect(() => {
    if (userId && loadedFor === userId) saveChat(AsyncStorage, userId, messages);
  }, [messages, userId, loadedFor]);

  const clear = async () => {
    if (busy || !(await confirm('Clear chat?', 'This removes your chat with Gullu from this device.', 'Clear'))) return;
    setMessages([]);
    if (userId) await clearChat(AsyncStorage, userId);
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next: Message[] = [...messages, { role: 'user', content: q, at: Date.now() }];
    setMessages(next);
    setDraft('');
    setBusy(true);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    try {
      if (isDemo) throw new Error('Gullu answers from your real payments. Sign in to use it.');
      const { data, error } = await supabase.functions.invoke<{ answer: string; used: string[]; sig?: string }>('ask', {
        body: { messages: contextForServer(next) },
      });
      if (error) {
        // Supabase wraps the function's JSON error; surface its message.
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(body?.error ?? friendly(error));
      }
      setMessages((m) => [...m, { role: 'assistant', content: data!.answer, used: data!.used, sig: data!.sig, at: Date.now() }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: (e as Error).message, error: true, at: Date.now() }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  // Keep the newest message in view when the keyboard opens, closes or moves (the list has just been resized).
  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [keyboard.height, keyboard.viewport?.height]);

  const canSend = !!draft.trim() && !busy;

  return (
    <View style={[{ backgroundColor: c.groupedBackground, overflow: 'hidden' }, screenStyle]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: c.outline, backgroundColor: c.groupedBackground }]}>
        <View style={styles.headerInner}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.back, pressed && { opacity: 0.5 }]}>
            <BackChevron color={c.tint} size={20} />
          </Pressable>
          <Avatar size={38} />
          <View style={{ flex: 1 }}>
            <Text pixel variant="title3">
              Gullu
            </Text>
            <Text variant="caption1" color="secondaryLabel" numberOfLines={1}>
              {busy ? 'counting coins…' : 'answers from your own payments'}
            </Text>
          </View>
          {messages.length > 0 ? (
            <Pressable
              onPress={clear}
              disabled={busy}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear chat"
              style={({ pressed }) => [styles.clear, (pressed || busy) && { opacity: 0.5 }]}>
              <Text variant="subheadline" style={{ color: c.tint }}>
                Clear
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.row}>
              <Avatar />
              <Sticker radius={16} lift={2} style={styles.bubble}>
                <Text variant="subheadline" weight="600">
                  Hi, I’m Gullu. Ask me anything about your money.
                </Text>
                <Text variant="footnote" color="secondaryLabel" style={{ marginTop: 4 }}>
                  I read your payment totals, never your messages. Chats stay on this device for 24 hours.
                </Text>
              </Sticker>
            </View>
            <Text variant="footnote" weight="600" color="secondaryLabel" style={styles.tryHead}>
              Try one
            </Text>
            <View style={styles.chips}>
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => send(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ask: ${s}`}
                  style={({ pressed }) => [
                    styles.chip,
                    { borderColor: c.outline, backgroundColor: pressed ? `${c.tint}26` : c.card },
                  ]}>
                  <Text variant="footnote" weight="500">
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <View key={i} style={[styles.row, styles.rowUser]}>
              <Sticker radius={16} lift={2} color={c.tint} style={[styles.bubble, styles.bubbleUser]}>
                <Text variant="subheadline" style={{ color: c.onTint }} selectable>
                  {m.content}
                </Text>
              </Sticker>
            </View>
          ) : (
            <View key={i} style={styles.row}>
              <Avatar />
              <Sticker radius={16} lift={2} color={m.error ? c.cream : undefined} style={[styles.bubble, styles.bubbleGullu]}>
                <Text variant="subheadline" style={m.error ? { color: '#5A2A12' } : undefined} selectable>
                  {m.content}
                </Text>
                {m.used?.length ? (
                  <View style={[styles.source, { borderTopColor: c.separator }]}>
                    <Text variant="caption1" color="secondaryLabel">
                      From your {[...new Set(m.used.map((u) => TOOL_LABEL[u] ?? u))].join(', ')}
                    </Text>
                  </View>
                ) : null}
              </Sticker>
            </View>
          ),
        )}
        {busy ? <Thinking /> : null}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: keyboardOpen ? 8 : insets.bottom + 10, borderTopColor: c.outline, backgroundColor: c.groupedBackground }]}>
        <View style={styles.composerInner}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask Gullu about your spending"
            placeholderTextColor={c.placeholder}
            selectionColor={c.tint}
            onSubmitEditing={() => send(draft)}
            returnKeyType="send"
            maxLength={500}
            accessibilityLabel="Message to Gullu"
            style={[type.body, styles.input, { color: c.label, backgroundColor: c.cardElevated, borderColor: c.fieldBorder, fontFamily, outlineStyle: 'none' } as never]}
          />
          <Pressable onPress={() => send(draft)} disabled={!canSend} accessibilityRole="button" accessibilityLabel="Send" accessibilityState={{ disabled: !canSend }}>
            {({ pressed }) => (
              <Sticker
                radius={14}
                lift={canSend ? 3 : 0}
                pressed={pressed}
                color={canSend ? c.tint : c.fill}
                style={styles.send}>
                <Text pixel style={{ color: canSend ? c.onTint : c.tertiaryLabel, fontSize: 22, lineHeight: 24 }}>
                  ↑
                </Text>
              </Sticker>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: 2, paddingBottom: 10 },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: layout.inset,
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
  },
  back: { width: 28, height: 36, justifyContent: 'center' },
  avatar: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  list: { padding: layout.inset, gap: 14, flexGrow: 1, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
  empty: { paddingTop: 8 },
  tryHead: { marginTop: 22, marginBottom: 8, marginLeft: 40 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 40 },
  chip: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', paddingVertical: 10, paddingHorizontal: 14, flexShrink: 1 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleGullu: { borderBottomLeftRadius: 4 },
  source: { marginTop: 8, paddingTop: 6, borderTopWidth: 1 },
  thinkingBubble: { paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  composer: { borderTopWidth: 2, paddingTop: 10 },
  composerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: layout.inset,
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
  },
  input: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 2, paddingHorizontal: 14 },
  clear: { paddingHorizontal: 4, paddingVertical: 6 },
  send: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
});
