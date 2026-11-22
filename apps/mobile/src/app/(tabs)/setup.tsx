// Capture setup: a real sequence, so it's drawn as a stepper. Each step is a sticker card on a rail;
// finished steps get the sprout-green check, the first unfinished one is outlined in clay.

import { useEffect, useState, type ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { useData } from '@/lib/data';
import { fullDate, signedMoney } from '@/lib/format';
import { copyText, enablePush, getConfig, hasSubscription, isStandalone, pushState, type PushState } from '@/lib/push';
import { friendly, ingestUrl, supabase } from '@/lib/api';
import { useClientValue } from '@/lib/use-client';
import { Badge, Button, Card } from '@/ui/controls';
import { PixelBar, Sticker } from '@/ui/sticker';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { layout, useColors, type ColorName } from '@/ui/theme';

type StepState = 'done' | 'current' | 'todo';

export default function SetupScreen() {
  const { mode } = useData();
  const installed = useClientValue(isStandalone, false);
  const push = usePushStep();
  const key = useKeyStep();
  const test = useTestStep();

  // The Shortcut has no signal of its own; the capture address being used means it works.
  const done = [installed, push.done, !!key.info, !!key.info?.last_used_at, test.ok];
  const current = done.findIndex((d) => !d);
  const stateOf = (i: number): StepState => (done[i] ? 'done' : i === current ? 'current' : 'todo');
  const count = done.filter(Boolean).length;

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

      <Progress count={count} total={done.length} />

      <InstallStep state={stateOf(0)} installed={installed} />
      <NotificationStep state={stateOf(1)} {...push} />
      <KeyStep state={stateOf(2)} {...key} />
      <ShortcutStep state={stateOf(3)} />
      <TestStep state={stateOf(4)} {...test} last />
    </Screen>
  );
}

function Progress({ count, total }: { count: number; total: number }) {
  const c = useColors();
  const all = count === total;
  return (
    <View style={styles.progress} accessibilityLabel={`${count} of ${total} steps done`}>
      <View style={styles.progressHead}>
        <Text variant="footnote" weight="600" color="secondaryLabel">
          {all ? 'All set. Gullak is eating every SMS.' : 'Your progress'}
        </Text>
        <Text pixel variant="headline" color={all ? 'green' : 'label'}>
          {count}/{total}
        </Text>
      </View>
      <PixelBar value={count / total} color={all ? c.green : c.tint} blocks={total} height={10} />
    </View>
  );
}

/** One step: a pixel number on the rail (check when done) and a sticker card for the content. */
function Step({
  n,
  title,
  state,
  status,
  statusTint,
  last,
  children,
}: {
  n: number;
  title: string;
  state: StepState;
  /** Short state on the right of the title ("On", "Not yet"). */
  status?: string;
  statusTint?: ColorName;
  last?: boolean;
  children: ReactNode;
}) {
  const c = useColors();
  const done = state === 'done';
  const current = state === 'current';
  const badgeBg = done ? c.green : current ? c.tint : c.card;
  const badgeFg = done ? '#FFFFFF' : current ? c.onTint : c.secondaryLabel;
  return (
    <View style={styles.step} accessibilityLabel={`Step ${n}: ${title}${done ? ', done' : current ? ', up next' : ''}`}>
      <View style={styles.rail}>
        <View style={[styles.num, { backgroundColor: badgeBg, borderColor: c.outline }]}>
          <Text pixel variant="headline" style={{ color: badgeFg }}>
            {done ? '✓' : n}
          </Text>
        </View>
        {!last ? <View style={[styles.line, { backgroundColor: done ? c.green : c.separator }]} /> : null}
      </View>
      <Sticker
        style={[styles.stepCard, current && { borderColor: c.tint }]}
        color={current ? c.cardElevated : c.card}
        lift={current ? layout.lift : 2}>
        <View style={styles.stepHead}>
          <Text variant="headline" style={styles.flex}>
            {title}
          </Text>
          {done ? (
            <Badge text="Done" tint="green" />
          ) : status ? (
            <Badge text={status} tint={statusTint ?? (current ? 'tint' : 'gray')} />
          ) : current ? (
            <Badge text="Up next" tint="tint" />
          ) : null}
        </View>
        {children}
      </Sticker>
    </View>
  );
}

function Note({ children, color = 'secondaryLabel' }: { children: ReactNode; color?: ColorName }) {
  return (
    <Text variant="subheadline" color={color}>
      {children}
    </Text>
  );
}

function InstallStep({ state, installed }: { state: StepState; installed: boolean }) {
  return (
    <Step n={1} title="Add to Home Screen" state={state} status={installed ? undefined : 'Not yet'}>
      <Note>
        {installed
          ? 'Opened from the Home Screen. Notifications can work here.'
          : 'In Safari, tap Share, then “Add to Home Screen”. Open the app from the new icon and come back to this tab.'}
      </Note>
    </Step>
  );
}

function usePushStep() {
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

  return { pushState: state, subscribed, busy, message, turnOn, done: state === 'granted' && subscribed };
}

function NotificationStep({
  state,
  pushState: ps,
  subscribed,
  busy,
  message,
  turnOn,
  done,
}: { state: StepState } & ReturnType<typeof usePushStep>) {
  const label: Record<PushState, string> = {
    unsupported: 'Not supported here',
    'needs-install': 'Install first',
    default: 'Off',
    denied: 'Blocked',
    granted: subscribed ? 'On' : 'Allowed',
  };
  return (
    <Step n={2} title="Turn on notifications" state={state} status={label[ps]} statusTint={ps === 'denied' ? 'red' : undefined}>
      <Note>{message ?? 'Get “₹250 at Swiggy 🍔” the moment a payment SMS arrives.'}</Note>
      {!done ? (
        <Button title="Turn On Notifications" onPress={turnOn} loading={busy} disabled={ps === 'denied'} style={styles.button} />
      ) : null}
    </Step>
  );
}

function useKeyStep() {
  const { mode } = useData();
  const [info, setInfo] = useState<{ key_hint: string; created_at: string; last_used_at: string | null } | null>(null);
  const [version, setVersion] = useState(0);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return { info, newKey, busy, error, create, live: mode === 'live' };
}

function KeyStep({ state, info, newKey, busy, error, create, live }: { state: StepState } & ReturnType<typeof useKeyStep>) {
  const c = useColors();
  const url = useClientValue(ingestUrl, null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (label: string, text: string) => {
    if (await copyText(text)) {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    }
  };

  return (
    <Step n={3} title="Get your capture address" state={state}>
      {newKey && url ? (
        <View style={[styles.well, { backgroundColor: c.fillTertiary, borderColor: c.separator }]}>
          <Text style={styles.mono} selectable>
            {`${url}/${newKey}`}
          </Text>
          <View style={styles.wellFoot}>
            <Text variant="footnote" color="secondaryLabel" style={styles.flex}>
              Your capture address. Copy it now and paste it into the Shortcut.
            </Text>
            <Button
              title={copied === 'address' ? 'Copied' : 'Copy'}
              kind="filled"
              size="small"
              onPress={() => copy('address', `${url}/${newKey}`)}
            />
          </View>
        </View>
      ) : info ? (
        <View style={[styles.well, { backgroundColor: c.fillTertiary, borderColor: c.separator }]}>
          <Text weight="600">{`Address ending …${info.key_hint}`}</Text>
          <Text variant="footnote" color="secondaryLabel">
            {info.last_used_at ? `Last used ${fullDate(info.last_used_at)}` : 'Not used yet'}
          </Text>
        </View>
      ) : null}
      <Note color={error ? 'red' : 'secondaryLabel'}>
        {error ??
          'It has a secret key built in, so only your Shortcut can add payments. It’s shown only once; making a new one turns the old one off.'}
      </Note>
      <Button
        title={info ? 'Make a New Address' : 'Create Capture Address'}
        kind={info ? 'gray' : 'filled'}
        onPress={create}
        loading={busy}
        disabled={!live}
        style={styles.button}
      />
    </Step>
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

function ShortcutStep({ state }: { state: StepState }) {
  const c = useColors();
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
    <Step n={4} title="Create the Shortcut automation" state={state}>
      {shortcutUrl ? (
        <Button title="Add the Gullak Shortcut" onPress={() => Linking.openURL(shortcutUrl)} style={styles.button} />
      ) : null}
      <View style={[styles.instructions, { borderColor: c.separator }]}>
        {steps.map((s, i) => (
          <View key={i} style={[styles.instruction, i > 0 && { borderTopColor: c.separator, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.subNum, { backgroundColor: c.fillTertiary }]}>
              <Text pixel variant="footnote" color="secondaryLabel">
                {i + 1}
              </Text>
            </View>
            <Text variant="subheadline" style={styles.flex}>
              {s}
            </Text>
          </View>
        ))}
      </View>
      <Text variant="footnote" color="secondaryLabel">
        Needs iOS 17 or later for “Run Immediately”.
      </Text>
    </Step>
  );
}

function useTestStep() {
  const { mode, refresh } = useData();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

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
        setOk(true);
        refresh();
      } else setResult(`Server answered: ${body.status}${body.reason ? ` (${body.reason})` : ''}`);
    } catch (e) {
      setResult(`Failed: ${friendly(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return { busy, result, ok, send, live: mode === 'live' };
}

function TestStep({ state, busy, result, send, live, last }: { state: StepState; last?: boolean } & ReturnType<typeof useTestStep>) {
  return (
    <Step n={5} title="Test it" state={state} last={last}>
      <Note>{result ?? 'Sends a ₹1 sample SMS through the same path as the Shortcut. You can hide it afterwards.'}</Note>
      <Button title="Send Test SMS" kind="tinted" onPress={send} loading={busy} disabled={!live} style={styles.button} />
      <View style={styles.connected}>
        <Badge text={live ? 'Connected' : 'Demo mode'} tint={live ? 'green' : 'orange'} />
      </View>
    </Step>
  );
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: layout.inset + 4, marginBottom: 20 },
  card: { marginHorizontal: layout.inset, marginBottom: 20 },
  flex: { flex: 1, minWidth: 0 },
  progress: { marginHorizontal: layout.inset + 4, marginBottom: 22, gap: 8 },
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  step: { flexDirection: 'row', marginHorizontal: layout.inset, gap: 10 },
  rail: { width: 36, alignItems: 'center' },
  num: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: layout.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { width: 3, flex: 1, minHeight: 18, marginVertical: 4, borderRadius: 1 },
  stepCard: { flex: 1, minWidth: 0, marginBottom: 18, padding: 14, gap: 10 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  button: { marginTop: 2 },
  plain: { alignSelf: 'flex-start', paddingHorizontal: 0, minHeight: 32 },
  well: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 6 },
  wellFoot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 },
  instructions: { borderRadius: 10, borderWidth: 1 },
  instruction: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 10, paddingVertical: 10 },
  subNum: { width: 22, height: 22, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginTop: -1 },
  connected: { alignItems: 'flex-start' },
});
