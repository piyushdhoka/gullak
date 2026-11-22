import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { useData } from '@/lib/data';
import { fullDate, signedMoney } from '@/lib/format';
import { copyText, enablePush, getConfig, hasSubscription, isStandalone, pushState, type PushState } from '@/lib/push';
import { friendly, ingestUrl, supabase } from '@/lib/api';
import { useClientValue } from '@/lib/use-client';
import { Badge, Button, Card } from '@/ui/controls';
import { Row, Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

export default function SetupScreen() {
  const { mode } = useData();
  return (
    <Screen title="Setup">
      <Text variant="subheadline" color="secondaryLabel" style={styles.intro}>
        Every bank SMS on your iPhone becomes a categorised payment here within seconds. Do these steps once.
      </Text>
      {mode === 'demo' ? (
        <Card style={styles.card}>
          <Text variant="headline">Demo mode</Text>
          <Text variant="subheadline" color="secondaryLabel" style={{ marginTop: 4 }}>
            This build shows sample data (EXPO_PUBLIC_DEMO=1).
          </Text>
        </Card>
      ) : null}
      <InstallStep />
      <NotificationStep />
      <KeyStep />
      <ShortcutStep />
      <TestStep />
    </Screen>
  );
}

function StepTitle({ n, title, done }: { n: number; title: string; done?: boolean }) {
  const c = useColors();
  return (
    <View style={styles.stepTitle}>
      <View style={[styles.stepNum, { backgroundColor: done ? c.green : c.tint }]}>
        <Text variant="footnote" weight="700" style={{ color: '#fff' }}>
          {done ? '✓' : n}
        </Text>
      </View>
      <Text variant="headline">{title}</Text>
    </View>
  );
}

function InstallStep() {
  const installed = useClientValue(isStandalone, false);
  return (
    <View>
      <StepTitle n={1} title="Add to Home Screen" done={installed} />
      <Section
        footer={
          installed
            ? 'Opened from the Home Screen. Notifications can work here.'
            : 'In Safari, tap Share, then “Add to Home Screen”. Open the app from the new icon and come back to this tab.'
        }>
        <Row title="Installed as an app" value={installed ? 'Yes' : 'Not yet'} />
      </Section>
    </View>
  );
}

function NotificationStep() {
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
      setMessage('Notifications are on for this iPhone.');
    } else setMessage(r.message);
  };

  const label: Record<PushState, string> = {
    unsupported: 'Not supported here',
    'needs-install': 'Install first',
    default: 'Off',
    denied: 'Blocked',
    granted: subscribed ? 'On' : 'Allowed',
  };
  const done = state === 'granted' && subscribed;
  return (
    <View>
      <StepTitle n={2} title="Turn on notifications" done={done} />
      <Section footer={message ?? 'Get “−₹250 · Swiggy · Food” the moment a payment SMS arrives.'}>
        <Row title="Payment alerts" value={label[state]} />
        {!done ? (
          <View style={styles.buttonRow}>
            <Button title="Turn On Notifications" onPress={turnOn} loading={busy} disabled={state === 'denied'} />
          </View>
        ) : null}
      </Section>
    </View>
  );
}

function KeyStep() {
  const { mode } = useData();
  const [info, setInfo] = useState<{ key_hint: string; created_at: string; last_used_at: string | null } | null>(null);
  const [version, setVersion] = useState(0);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const url = useClientValue(ingestUrl, null);

  useEffect(() => {
    if (mode !== 'live') return;
    let alive = true;
    supabase
      .from('capture_keys')
      .select('key_hint, created_at, last_used_at')
      .maybeSingle()
      .then(({ data }) => alive && setInfo(data ?? null));
    return () => {
      alive = false;
    };
  }, [version, mode]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('create_capture_key');
      if (error) throw error;
      setNewKey(data as string);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (label: string, text: string) => {
    if (await copyText(text)) {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    }
  };

  return (
    <View>
      <StepTitle n={3} title="Get your capture address" done={!!info} />
      <Section
        footer={
          error ?? 'It has a secret key built in, so only your Shortcut can add payments. It’s shown only once; making a new one turns the old one off.'
        }
      >
        {newKey && url ? (
          <Row
            title={
              <Text style={styles.mono} selectable>
                {`${url}/${newKey}`}
              </Text>
            }
            subtitle="Your capture address. Copy it now and paste it into the Shortcut."
            right={
              <Button
                title={copied === 'address' ? 'Copied' : 'Copy'}
                kind="filled"
                size="small"
                onPress={() => copy('address', `${url}/${newKey}`)}
              />
            }
          />
        ) : info ? (
          <Row
            title={`Address ending …${info.key_hint}`}
            subtitle={info.last_used_at ? `Last used ${fullDate(info.last_used_at)}` : 'Not used yet'}
          />
        ) : null}
        <View style={styles.buttonRow}>
          <Button
            title={info ? 'Make a New Address' : 'Create Capture Address'}
            kind={info ? 'gray' : 'filled'}
            onPress={create}
            loading={busy}
            disabled={mode !== 'live'}
          />
        </View>
      </Section>
    </View>
  );
}

const SHORTCUT_STEPS = [
  'Open the Shortcuts app › Automation › + › Message.',
  'Message Contains: type a single space, so every message triggers it. Choose “Run Immediately” and turn off “Notify When Run”. Tap Next.',
  'Choose “New Blank Automation”, then add the action “Get Contents of URL”.',
  'URL: paste your capture address. Tap the arrow to show more and set Method to POST. No headers needed.',
  'Request Body: JSON. Add a Text field named text and set it to Shortcut Input (Content). Add a Text field named received_at and set it to Current Date.',
  'Tap Done. Personal messages are dropped by the server without being saved; only bank SMS are kept.',
];

// With the shared Shortcut there's nothing to build by hand: install it, paste, point an automation at it.
const SHARED_SHORTCUT_STEPS = [
  'Tap “Add the Gullak Shortcut” above, then “Add Shortcut”. When it asks, paste your capture address.',
  'Open the Shortcuts app › Automation › + › Message.',
  'Message Contains: type a single space, so every message triggers it. Choose “Run Immediately” and turn off “Notify When Run”. Tap Next.',
  'Pick “Gullak Capture” as the shortcut to run. Done.',
];

function ShortcutStep() {
  const [shortcutUrl, setShortcutUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getConfig()
      .then((r) => alive && setShortcutUrl(r.shortcutUrl))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const steps = shortcutUrl ? SHARED_SHORTCUT_STEPS : SHORTCUT_STEPS;

  return (
    <View>
      <StepTitle n={4} title="Create the Shortcut automation" />
      {shortcutUrl ? (
        <View style={styles.shortcutButton}>
          <Button title="Add the Gullak Shortcut" onPress={() => Linking.openURL(shortcutUrl)} />
        </View>
      ) : null}
      <Section inset={false} footer="Needs iOS 17 or later for “Run Immediately”.">
        {steps.map((s, i) => (
          <Row
            key={i}
            title={
              <View style={styles.instruction}>
                <Text color="secondaryLabel" tabular style={{ width: 22 }}>
                  {i + 1}.
                </Text>
                <Text variant="subheadline" style={{ flex: 1 }}>
                  {s}
                </Text>
              </View>
            }
          />
        ))}
      </Section>
    </View>
  );
}

function TestStep() {
  const { mode, refresh } = useData();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setResult(null);
    const ref = String(Math.floor(1e11 + Math.random() * 9e11));
    const d = new Date();
    const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
    const text = `Sent Rs.1.00\nFrom HDFC Bank A/C *0000\nTo TEST CAFE\nOn ${date}\nRef ${ref}\nNot You?`;
    try {
      // Same function the Shortcut reaches; signed in, it knows who you are without the capture key.
      const { data: body, error } = await supabase.functions.invoke<{
        status: string;
        reason?: string;
        transaction?: { amount: number; direction: 'debit' | 'credit'; merchant: string; category: string };
      }>('ingest', { body: { text, received_at: d.toISOString(), test: true } });
      if (error || !body) throw error ?? new Error('No answer');
      if (body.status === 'saved' && body.transaction) {
        setResult(`Saved ${signedMoney(body.transaction)} · ${body.transaction.merchant}. Check Activity and your notifications.`);
        refresh();
      } else setResult(`Server answered: ${body.status}${body.reason ? ` (${body.reason})` : ''}`);
    } catch (e) {
      setResult(`Failed: ${friendly(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <StepTitle n={5} title="Test it" />
      <Section footer={result ?? 'Sends a ₹1 sample SMS through the same path as the Shortcut. You can hide it afterwards.'}>
        <View style={styles.buttonRow}>
          <Button title="Send Test SMS" kind="tinted" onPress={send} loading={busy} disabled={mode !== 'live'} />
        </View>
      </Section>
      <View style={{ alignItems: 'center', marginTop: -16 }}>
        <Badge text={mode === 'live' ? 'Connected' : 'Demo mode'} tint={mode === 'live' ? 'green' : 'orange'} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: layout.inset + 4, marginBottom: 24 },
  card: { marginHorizontal: layout.inset, marginBottom: 24 },
  stepTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: layout.inset + 4, marginBottom: 10 },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonRow: { padding: 12 },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 },
  instruction: { flexDirection: 'row', alignItems: 'flex-start' },
  shortcutButton: { marginHorizontal: layout.inset, marginBottom: 16 },
});
