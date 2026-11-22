// Add a payment by hand: cash, UPI Lite, anything that doesn't send a bank SMS.

import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { CategoryTile } from '@/components/txn-row';
import { CATEGORIES } from '@/lib/categories';
import { useData } from '@/lib/data';
import { dayLabel } from '@/lib/format';
import { Button, Field, SegmentedControl } from '@/ui/controls';
import { Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

const SPEND = CATEGORIES.filter((c) => c !== 'Income' && c !== 'Refund');
const RECEIVE = ['Income', 'Refund', 'Transfers', 'Other'] as const;

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

export default function AddScreen() {
  const c = useColors();
  const { addManual } = useData();
  const [direction, setDirection] = useState<'debit' | 'credit'>('debit');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Food');
  const [payee, setPayee] = useState('');
  const [note, setNote] = useState('');
  const [day, setDay] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = parseAmount(amount);
  const valid = value > 0 && value <= 1e8;
  const options = direction === 'debit' ? SPEND : RECEIVE;

  const switchDirection = (d: 'debit' | 'credit') => {
    setDirection(d);
    setCategory(d === 'debit' ? 'Food' : 'Income');
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const when = daysBack(day);
      if (day > 0) when.setHours(12, 0, 0, 0);
      await addManual({ amount: value, category, direction, payee, note, occurredAt: when });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen title="Add Payment" largeTitle={false} back="Cancel" tabBar={false}>
        <View style={styles.pad}>
          <SegmentedControl
            options={[
              { value: 'debit', label: 'Paid' },
              { value: 'credit', label: 'Received' },
            ]}
            value={direction}
            onChange={switchDirection}
          />
        </View>

        <Section footer="Cash, UPI Lite, or anything your bank didn’t text you about.">
          <Field
            label="Amount ₹"
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^\d.,]/g, ''))}
            placeholder="0"
            keyboardType="decimal-pad"
            autoFocus
            style={styles.amount}
          />
          <Field label={direction === 'debit' ? 'Paid to' : 'From'} value={payee} onChangeText={setPayee} placeholder="Optional" maxLength={60} />
          <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" maxLength={200} />
        </Section>

        <Section header="When">
          <View style={styles.chips}>
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <Chip key={n} label={n === 0 ? 'Today' : n === 1 ? 'Yesterday' : dayLabel(daysBack(n))} on={day === n} onPress={() => setDay(n)} />
            ))}
          </View>
        </Section>

        <Section header="Category">
          <View style={styles.grid}>
            {options.map((cat) => {
              const on = cat === category;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.cat, { borderColor: on ? c.tint : 'transparent', backgroundColor: on ? `${c.tint}14` : 'transparent' }]}>
                  <CategoryTile category={cat} size={36} />
                  <Text variant="caption1" weight={on ? '600' : '400'} numberOfLines={1}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <View style={styles.pad}>
          <Button title="Save" onPress={save} loading={busy} disabled={!valid} />
          {error ? (
            <Text variant="footnote" color="red" align="center" style={{ marginTop: 10 }}>
              {error}
            </Text>
          ) : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      style={[styles.chip, { backgroundColor: on ? c.tint : c.fillTertiary }]}>
      <Text variant="footnote" weight="600" style={{ color: on ? '#fff' : c.label }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { marginHorizontal: layout.inset, marginBottom: 20 },
  amount: { fontSize: 22, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 6 },
  cat: { width: '25%', alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
});
