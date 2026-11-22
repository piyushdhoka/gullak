// Gullu, Gullak's chatbot: chat with your own spending data. The server function runs the AI with our stats tools.

import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { friendly, isDemo, supabase } from '@/lib/api';
import { BackChevron } from '@/ui/icons';
import { Text } from '@/ui/text';
import { fontFamily, layout, type, useColors } from '@/ui/theme';
import { router } from 'expo-router';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  used?: string[];
  error?: boolean;
}

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

export default function AskScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next: Message[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setDraft('');
    setBusy(true);
    try {
      if (isDemo) throw new Error('Gullu answers from your real payments. Sign in to use it.');
      const { data, error } = await supabase.functions.invoke<{ answer: string; used: string[] }>('ask', {
        body: { messages: next.filter((m) => !m.error).map(({ role, content }) => ({ role, content })) },
      });
      if (error) {
        // Supabase wraps the function's JSON error; surface its message.
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(body?.error ?? friendly(error));
      }
      setMessages((m) => [...m, { role: 'assistant', content: data!.answer, used: data!.used }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.groupedBackground }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: c.separator }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" style={styles.back}>
          <BackChevron color={c.tint} size={18} />
          <Text color="tint">Back</Text>
        </Pressable>
        <Text variant="headline">Gullu</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView ref={scroll} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Text variant="title3" weight="600">
              Hi, I’m Gullu. Ask me about your money
            </Text>
            <Text variant="subheadline" color="secondaryLabel" style={{ marginTop: 4, marginBottom: 16 }}>
              Gullu answers from your own payments and only sees totals, never your messages.
            </Text>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => send(s)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.suggestion, { backgroundColor: c.card, opacity: pressed ? 0.6 : 1 }]}>
                <Text variant="subheadline">{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {messages.map((m, i) => (
          <View key={i} style={[styles.bubbleRow, m.role === 'user' && { justifyContent: 'flex-end' }]}>
            <View
              style={[
                styles.bubble,
                m.role === 'user'
                  ? { backgroundColor: c.tint, borderBottomRightRadius: 6 }
                  : { backgroundColor: m.error ? `${c.orange}22` : c.card, borderBottomLeftRadius: 6 },
              ]}>
              <Text variant="subheadline" style={m.role === 'user' ? { color: '#fff' } : undefined} selectable>
                {m.content}
              </Text>
              {m.used?.length ? (
                <Text variant="caption2" color="secondaryLabel" style={{ marginTop: 6 }}>
                  From your {[...new Set(m.used.map((u) => TOOL_LABEL[u] ?? u))].join(', ')}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
        {busy ? (
          <Text variant="footnote" color="secondaryLabel" style={styles.thinking}>
            Gullu is looking at your payments…
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: insets.bottom + 8, borderTopColor: c.separator, backgroundColor: c.groupedBackground }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask about your spending"
          placeholderTextColor={c.tertiaryLabel}
          onSubmitEditing={() => send(draft)}
          returnKeyType="send"
          maxLength={500}
          style={[type.body, styles.input, { color: c.label, backgroundColor: c.card, fontFamily }]}
        />
        <Pressable
          onPress={() => send(draft)}
          disabled={!draft.trim() || busy}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={({ pressed }) => [styles.send, { backgroundColor: c.tint, opacity: !draft.trim() || busy ? 0.4 : pressed ? 0.7 : 1 }]}>
          <Text weight="700" style={{ color: '#fff', fontSize: 18 }}>
            ↑
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: layout.inset, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 60 },
  list: { padding: layout.inset, gap: 10, flexGrow: 1 },
  empty: { paddingTop: 12 },
  suggestion: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, marginBottom: 8 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '85%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  thinking: { paddingLeft: 6 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: layout.inset, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 42, borderRadius: 21, paddingHorizontal: 16 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
