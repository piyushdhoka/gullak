// Every notification Gullak sends, drawn like it lands on a lock screen, built from the real copy
// builders in @gullak/core/push-voice with sample data. Tapping one drops it in as the in-app banner.
// At the top: this device's push permission, and the button to turn it on.

import {
  budgetPush,
  diaryPush,
  importPush,
  jarPush,
  paymentPush,
  quietPush,
  subscriptionPush,
  type PaymentInfo,
  type RichPush,
} from '@gullak/core/push-voice.ts';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NotifPreview } from '@/components/notif-preview';
import { showPushBanner } from '@/components/push-banner';
import { useData } from '@/lib/data';
import { enablePush, hasSubscription, pushState, type PushState } from '@/lib/push';
import type { Transaction } from '@/lib/types';
import { useClientValue } from '@/lib/use-client';
import { Badge, Button } from '@/ui/controls';
import { Screen } from '@/ui/screen';
import { Sticker } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { layout, useColors, type ColorName } from '@/ui/theme';

interface Sample {
  key: string;
  name: string;
  /** When Gullak sends it. */
  when: string;
  push: RichPush;
  /** Which real payment a tap on the demo banner should open. */
  match?: (t: Transaction) => boolean;
}

const pay = (p: Omit<PaymentInfo, 'bank' | 'account'> & Partial<PaymentInfo>): RichPush =>
  paymentPush({ bank: 'HDFC Bank', account: '4521', ...p });

function samples(today: string): { header: string; items: Sample[] }[] {
  const month = today.slice(0, 7);
  return [
    {
      header: 'Payments',
      items: [
        {
          key: 'payment',
          name: 'Payment',
          when: 'a bank SMS for a spend arrives',
          push: pay({ id: 'sample-pay', amount: 250, direction: 'debit', merchant: 'Swiggy', category: 'Food', category_source: 'merchant' }),
          match: (t) => t.merchant === 'Swiggy',
        },
        {
          key: 'income',
          name: 'Money in',
          when: 'salary, refunds, anyone paying you',
          push: pay({ id: 'sample-in', amount: 85000, direction: 'credit', payee: 'Acme Labs', category: 'Income', category_source: 'heuristic' }),
          match: (t) => t.direction === 'credit',
        },
        {
          key: 'new-payee',
          name: 'New payee',
          when: 'Gullak can’t tell what a payment was',
          push: pay({ id: 'sample-new', amount: 480, direction: 'debit', payee: 'Sharma General Store', category: 'Other', category_source: 'unknown' }),
        },
        {
          key: 'big-spend',
          name: 'Big spend',
          when: 'one payment of ₹10,000 or more',
          push: pay({ id: 'sample-big', amount: 24999, direction: 'debit', merchant: 'Croma', category: 'Shopping', category_source: 'merchant' }),
          match: (t) => t.direction === 'debit' && t.category === 'Shopping',
        },
      ],
    },
    {
      header: 'Budgets',
      items: [
        {
          key: 'budget-warning',
          name: 'Budget warning',
          when: 'a budget passes 80%',
          push: budgetPush({ category: 'Food', limit: 6000, spent: 4800, daysLeft: 9, month }),
        },
        {
          key: 'budget-over',
          name: 'Budget burst',
          when: 'a budget goes over',
          push: budgetPush({ category: 'Shopping', limit: 5000, spent: 5173, daysLeft: 9, month }),
        },
      ],
    },
    {
      header: 'Nudges',
      items: [
        {
          key: 'quiet',
          name: 'Gullak is hungry',
          when: 'no payments for a few days',
          push: quietPush(3, 'preview'),
        },
        {
          key: 'diary',
          name: 'Evening diary',
          when: 'every evening, with today’s total',
          push: diaryPush({ date: today, spent: 640, topName: 'Swiggy', topCategory: 'Food', streak: 12 }),
        },
      ],
    },
    {
      header: 'Jars and repeats',
      items: [
        {
          key: 'jar',
          name: 'Jar milestone',
          when: 'a jar passes 25, 50, 75 or 100%',
          push: jarPush({ id: 'sample-jar', name: 'Goa trip', emoji: '🏖️', percent: 50, left: 15000 }),
        },
        {
          key: 'subscription',
          name: 'Subscription due',
          when: 'the day before a repeat payment',
          push: subscriptionPush({ name: 'Netflix', amount: 649, key: 'netflix' }),
        },
      ],
    },
    {
      header: 'On Android',
      items: [
        {
          key: 'import',
          name: 'Import done',
          when: 'Gullak has read your past SMS',
          push: importPush(214, 6),
        },
      ],
    },
  ];
}

const SCREEN_NAMES: Record<string, string> = {
  '/': 'Summary',
  '/activity': 'Activity',
  '/transaction': 'the payment',
  '/review': 'Review',
  '/budgets': 'Budgets',
  '/setup': 'Setup',
  '/jar': 'the jar',
  '/jars': 'Jars',
  '/subscriptions': 'Repeats',
};

function opens(url?: string) {
  return url ? SCREEN_NAMES[url.split('?')[0]] ?? null : null;
}

export default function NotificationsScreen() {
  const { transactions, jars } = useData();
  const groups = useMemo(() => samples(new Date().toISOString().slice(0, 10)), []);

  // The previews use made-up ids; point the demo banner at real screens so its tap lands somewhere.
  const demo = (s: Sample) => {
    const txn = (s.match && transactions.find(s.match)) ?? transactions.find((t) => t.direction === (s.key === 'income' ? 'credit' : 'debit'));
    const fix = (url?: string) => {
      if (!url) return url;
      if (url.startsWith('/transaction?id=sample-')) return txn ? `/transaction?id=${txn.id}` : '/activity';
      if (url.startsWith('/jar?id=sample-')) return jars[0] ? `/jar?id=${jars[0].id}` : '/jars';
      return url;
    };
    showPushBanner({
      title: s.push.title,
      body: s.push.body,
      kind: s.push.kind,
      url: fix(s.push.url),
      actions: s.push.actions?.map((a) => ({ ...a, url: fix(a.url ?? s.push.url) })),
    });
  };

  return (
    <Screen title="Notifications" back="Back" tabBar={false}>
      <Text variant="subheadline" color="secondaryLabel" style={styles.intro}>
        Gullak only buzzes when it has something real to say: an amount, a name, a number of days. Here’s everything it can send.
      </Text>

      <Permission />

      <View style={[styles.note, styles.inset]}>
        <Text style={styles.noteIcon}>📱</Text>
        <Text variant="footnote" color="secondaryLabel" style={styles.flex}>
          On iPhone the buttons don’t show: a tap on the notification opens the right screen. Android and computers show up to two
          buttons.
        </Text>
      </View>

      <Text variant="footnote" weight="600" color="tint" style={[styles.inset, styles.tapHint]}>
        Tap any preview to see it drop in, the way it does while Gullak is open.
      </Text>

      {groups.map((g) => (
        <View key={g.header} style={styles.group}>
          <Text variant="footnote" weight="600" color="secondaryLabel" style={styles.header} accessibilityRole="header">
            {g.header}
          </Text>
          {g.items.map((s) => {
            const dest = opens(s.push.url);
            return (
              <View key={s.key} style={styles.item}>
                <View style={styles.label}>
                  <Text variant="footnote" style={styles.flex}>
                    <Text variant="footnote" weight="600">
                      {s.name}
                    </Text>
                    <Text variant="footnote" color="secondaryLabel">
                      {` · when ${s.when}`}
                    </Text>
                  </Text>
                  {dest ? (
                    <Text variant="caption1" color="tertiaryLabel" numberOfLines={1}>
                      opens {dest}
                    </Text>
                  ) : null}
                </View>
                <NotifPreview
                  push={s.push}
                  onPress={() => demo(s)}
                  accessibilityHint="Shows this notification as an in-app banner"
                />
              </View>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}

/** This device's push permission, with the button to turn it on (same flow as Setup step 2). */
function Permission() {
  const c = useColors();
  const initialState = useClientValue<PushState>(pushState, 'unsupported');
  const [stateAfterTap, setStateAfterTap] = useState<PushState | null>(null);
  const state = stateAfterTap ?? initialState;
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    hasSubscription().then((s) => alive && setSubscribed(s));
    return () => {
      alive = false;
    };
  }, []);

  const turnOn = async () => {
    setBusy(true);
    const r = await enablePush();
    setBusy(false);
    setStateAfterTap(pushState());
    if (r.ok) {
      setSubscribed(true);
      setMessage('Notifications are on for this device. Gullak will tap you on the shoulder when it matters.');
    } else setMessage(r.message);
  };

  const on = state === 'granted' && subscribed;
  const badge: Record<PushState, [string, ColorName]> = {
    unsupported: ['Not supported here', 'gray'],
    'needs-install': ['Install first', 'orange'],
    default: ['Off', 'tint'],
    denied: ['Blocked', 'red'],
    granted: subscribed ? ['On', 'green'] : ['Allowed', 'orange'],
  };
  const text: Record<PushState, string> = {
    unsupported: 'This browser can’t show notifications. The previews below still show what you’d get.',
    'needs-install': 'On iPhone, add Gullak to your Home Screen first (Share, then “Add to Home Screen”) and open it from there.',
    default: 'Off for now. Turn them on and every payment SMS shows up as a notification within seconds.',
    denied: 'Blocked in your browser or phone settings. Allow notifications for Gullak there, then come back.',
    granted: subscribed
      ? 'On for this device. Gullak will tap you on the shoulder when it matters.'
      : 'Allowed, but this device isn’t subscribed yet. Turn them on to finish.',
  };
  const [label, tint] = badge[state];

  return (
    <Sticker style={styles.permission} color={c.card}>
      <View style={styles.permHead}>
        <View style={[styles.avatar, { backgroundColor: c.cream, borderColor: c.outline }]}>
          <Image source={require('../../assets/images/logo-192.png')} style={styles.mascot} contentFit="contain" />
        </View>
        <View style={styles.flex}>
          <Text variant="headline">Push notifications</Text>
          <Text variant="footnote" color="secondaryLabel">
            On this device
          </Text>
        </View>
        <Badge text={label} tint={tint} />
      </View>
      <Text variant="subheadline" color={message && !on ? 'red' : 'secondaryLabel'}>
        {message ?? text[state]}
      </Text>
      {!on ? (
        <Button title="Turn On Notifications" onPress={turnOn} loading={busy} disabled={state === 'denied'} />
      ) : null}
    </Sticker>
  );
}

const styles = StyleSheet.create({
  inset: { marginHorizontal: layout.inset + 4 },
  flex: { flex: 1, minWidth: 0 },
  intro: { paddingHorizontal: layout.inset + 4, marginBottom: 20 },
  permission: { marginHorizontal: layout.inset, marginBottom: 14, padding: 16, gap: 12 },
  permHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mascot: { width: 40, height: 40 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 22 },
  noteIcon: { fontSize: 15, lineHeight: 18 },
  tapHint: { marginBottom: 18 },
  group: { marginHorizontal: layout.inset, marginBottom: 26 },
  header: { paddingHorizontal: 4, paddingBottom: 8 },
  item: { marginBottom: 14, gap: 6 },
  label: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 4 },
});
