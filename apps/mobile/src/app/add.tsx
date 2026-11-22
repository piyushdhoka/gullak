// Add a payment by hand: cash, UPI Lite, anything that doesn't send a bank SMS.
// A calculator-style sheet: a huge pixel amount, a keypad, a tile grid of categories, one Save.

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryGrid, groupAmount, Keypad, PillChoices, typeAmount, type AmountKey } from '@/components/add-parts';
import { guessFromSms } from '@/components/sms-guess';
import { CATEGORIES } from '@/lib/categories';
import { useData } from '@/lib/data';
import { dayLabel, money } from '@/lib/format';
import { Button, Card, Field, SegmentedControl } from '@/ui/controls';
import { Screen } from '@/ui/screen';
import { Coin, MatkaBand } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

const SPEND = CATEGORIES.filter((c) => c !== 'Income' && c !== 'Refund');
const RECEIVE = ['Income', 'Refund', 'Transfers', 'Other'] as const;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function daysBack(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** "1,250.50" / "1250" → 1250.5; anything else → NaN. */
function parseAmount(raw: string) {
  const clean = raw.replace(/[,\s₹]/g, '');
  return /^\d+(\.\d{1,2})?$/.test(clean) ? Number(clean) : NaN;
}

const DAYS = [0, 1, 2, 3, 4, 5, 6].map((n) => ({
  value: n,
  label: n === 0 ? 'Today' : n === 1 ? 'Yesterday' : dayLabel(daysBack(n)),
}));

export default function AddScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { addManual, inbox, dismissSms } = useData();
  // Opened from "Add as payment" on an SMS Gullak couldn't read: start from what the SMS seems to say.
  const { sms: smsId } = useLocalSearchParams<{ sms?: string }>();
  const sms = smsId ? inbox.find((m) => m.id === smsId) : undefined;
  const [guess] = useState(() => (sms ? guessFromSms(sms.body) : null));
  const smsDay = sms ? Math.round((startOfDay(new Date()) - startOfDay(new Date(sms.received_at))) / 86_400_000) : -1;
  const [direction, setDirection] = useState<'debit' | 'credit'>(guess?.direction ?? 'debit');
  const [amount, setAmount] = useState(guess?.amount ?? '');
  const [category, setCategory] = useState<string>(guess?.direction === 'credit' ? 'Income' : 'Food');
  const [payee, setPayee] = useState(guess?.payee ?? '');
  const [note, setNote] = useState('');
  const [day, setDay] = useState(smsDay >= 0 && smsDay <= 6 ? smsDay : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = parseAmount(amount);
  const valid = value > 0 && value <= 1e8;
  const options = direction === 'debit' ? SPEND : RECEIVE;
  const shown = groupAmount(amount);
  const amountSize = shown.length <= 6 ? 60 : shown.length <= 9 ? 48 : 38;

  const switchDirection = (d: 'debit' | 'credit') => {
    setDirection(d);
    setCategory(d === 'debit' ? 'Food' : 'Income');
  };

  const onKey = (k: AmountKey) => setAmount((prev) => typeAmount(prev, k));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      let when = daysBack(day);
      if (day > 0) when.setHours(12, 0, 0, 0);
      // Same day as the SMS: use its exact time.
      if (sms && day === smsDay) when = new Date(sms.received_at);
      await addManual({ amount: value, category, direction, payee, note, occurredAt: when });
      // Now it's a payment, the SMS no longer needs to wait in "Not recognised".
      if (sms) await dismissSms(sms.id).catch(() => {});
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen title={sms ? 'Add from SMS' : 'Add a payment'} largeTitle={false} back="Cancel" tabBar={false}>
        <View style={styles.pad}>
          {sms ? (
            <View style={[styles.smsNote, { backgroundColor: c.fillTertiary, borderColor: c.separator }]}>
              <Text variant="caption1" weight="600" color="secondaryLabel">
                The SMS Gullak couldn’t read. Check the amount, pick a category, save.
              </Text>
              <Text variant="footnote" numberOfLines={5} selectable>
                {sms.body}
              </Text>
            </View>
          ) : null}
          <SegmentedControl
            options={[
              { value: 'debit', label: 'Paid' },
              { value: 'credit', label: 'Received' },
            ]}
            value={direction}
            onChange={switchDirection}
          />
        </View>

        <Card tone="clay" style={styles.amountCard}>
          <View style={styles.amountTop}>
            <Text variant="subheadline" weight="600" style={{ color: c.onTint, opacity: 0.85 }}>
              {direction === 'debit' ? 'You paid' : 'You received'}
            </Text>
            <Coin size={24} />
          </View>
          <View
            style={styles.amountLine}
            accessibilityRole="text"
            accessibilityLabel={amount ? `Amount ${money(value || 0)}` : 'Amount, none yet'}
            accessibilityLiveRegion="polite">
            <Text pixel style={[styles.rupee, { color: c.onTint, fontSize: amountSize * 0.6, lineHeight: amountSize * 1.15 }]}>
              ₹
            </Text>
            <Text
              pixel
              numberOfLines={1}
              style={{
                color: c.onTint,
                opacity: amount ? 1 : 0.45,
                fontSize: amountSize,
                lineHeight: amountSize * 1.15,
                flexShrink: 1,
              }}>
              {shown}
            </Text>
          </View>
          <MatkaBand color={c.cream} style={styles.band} />
          <Text variant="footnote" style={{ color: c.onTint, opacity: 0.85 }}>
            Cash, UPI Lite, or anything your bank didn’t text you about.
          </Text>
        </Card>

        <Keypad onKey={onKey} />

        <Text variant="footnote" weight="600" color="secondaryLabel" style={styles.head} accessibilityRole="header">
          Category
        </Text>
        <CategoryGrid options={options} value={category} onChange={setCategory} />

        <Text variant="footnote" weight="600" color="secondaryLabel" style={styles.head} accessibilityRole="header">
          When
        </Text>
        <PillChoices label="When" options={DAYS} value={day} onChange={setDay} />
        <View style={{ height: 14 }} />

        <View>
          <Field
            label={direction === 'debit' ? 'Paid to' : 'From'}
            value={payee}
            onChangeText={setPayee}
            placeholder="Optional"
            maxLength={60}
            accessibilityLabel={direction === 'debit' ? 'Paid to' : 'Received from'}
          />
          <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" maxLength={200} accessibilityLabel="Note" />
        </View>

        {/* Room for the Save bar that floats over the bottom of the sheet. */}
        <View style={{ height: 72 }} />
      </Screen>

      <View
        style={[
          styles.saveBar,
          { paddingBottom: insets.bottom + 12, backgroundColor: c.chrome, borderTopColor: c.separator },
        ]}>
        <View style={styles.saveInner}>
          {error ? (
            <Text variant="footnote" color="red" align="center" style={{ marginBottom: 8 }} accessibilityLiveRegion="assertive">
              {error}
            </Text>
          ) : null}
          <Button
            title={valid ? `Save ${money(value, { whole: Number.isInteger(value) })}` : 'Type an amount'}
            onPress={save}
            loading={busy}
            disabled={!valid}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  smsNote: { borderRadius: 12, borderWidth: 1.5, padding: 12, gap: 6, marginBottom: 12 },
  pad: { marginHorizontal: layout.inset, marginBottom: 16 },
  amountCard: { marginHorizontal: layout.inset, marginBottom: 16, paddingTop: 14, paddingBottom: 14 },
  amountTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amountLine: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4, minHeight: 72 },
  rupee: { opacity: 0.9 },
  band: { marginTop: 2, marginBottom: 10, opacity: 0.9 },
  head: { marginHorizontal: layout.inset + layout.inset, marginBottom: 8 },
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveInner: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: layout.inset },
});
