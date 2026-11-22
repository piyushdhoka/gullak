import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { explainCategory, type Explanation } from '@gullak/core';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CategoryTile } from '@/components/txn-row';
import { CATEGORIES } from '@/lib/categories';
import { useData } from '@/lib/data';
import { accountLabel, displayName, fullDate, signedMoney } from '@/lib/format';
import { isDemo, supabase } from '@/lib/api';
import { Row, Section, SwitchRow } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { fontFamily, layout, type, useColors } from '@/ui/theme';

const CHANNEL: Record<string, string> = {
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Bank transfer',
  atm: 'ATM',
  cash: 'Cash',
  other: 'Other',
};

const SOURCE_LABEL: Record<string, string | undefined> = {
  user: 'Chosen by you',
  merchant: 'Known merchant',
  heuristic: undefined,
  model: 'Guessed automatically, check it',
  unknown: 'Tap Change to pick one; it’s remembered for this payee',
};

/** "Why?": the reason for the category, and three one-tap fixes. */
function Why({ why, onPick }: { why: Explanation; onPick: (category: string) => void }) {
  const c = useColors();
  return (
    <Section header="Why this category?">
      <View style={styles.why}>
        <Text variant="subheadline">{why.reason}</Text>
        <View style={styles.whyChips}>
          {why.alternatives.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => onPick(cat)}
              accessibilityRole="button"
              accessibilityLabel={`Change to ${cat}`}
              style={({ pressed }) => [styles.whyChip, { backgroundColor: c.fillTertiary, opacity: pressed ? 0.6 : 1 }]}>
              <CategoryTile category={cat} size={22} />
              <Text variant="footnote" weight="600">
                {cat}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Section>
  );
}

export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, setCategory, updateTransaction } = useData();
  const t = transactions.find((x) => x.id === id);

  const [picking, setPicking] = useState(false);
  const [applyAll, setApplyAll] = useState(true);
  const [sms, setSms] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo || !t?.sms_id) return;
    let alive = true;
    supabase
      .from('sms_inbox')
      .select('body')
      .eq('id', t.sms_id)
      .maybeSingle()
      .then(({ data }) => alive && data && setSms(data.body as string));
    return () => {
      alive = false;
    };
  }, [t?.sms_id]);

  if (!t) {
    return (
      <Screen title="Payment" largeTitle={false} back="Back" tabBar={false}>
        <Text color="secondaryLabel" align="center" style={{ marginTop: 40 }}>
          This payment isn’t loaded.
        </Text>
      </Screen>
    );
  }

  const samePayee = t.payee_key ? transactions.filter((x) => x.payee_key === t.payee_key).length : 0;

  return (
    <Screen title={displayName(t)} largeTitle={false} back="Back" tabBar={false}>
      <View style={styles.head}>
        <CategoryTile category={t.category} size={60} />
        <Text variant="title3" align="center" style={{ marginTop: 12 }}>
          {displayName(t)}
        </Text>
        <Text
          rounded
          tabular
          color={t.direction === 'credit' ? 'green' : 'label'}
          style={[styles.amount, t.hidden && { opacity: 0.4 }]}>
          {signedMoney(t)}
        </Text>
        <Text variant="subheadline" color="secondaryLabel">
          {fullDate(t.occurred_at)}
        </Text>
      </View>

      <Section header="Category">
        <Row
          left={<CategoryTile category={t.category} />}
          title={t.category_source === 'unknown' ? 'Needs a category' : t.category}
          subtitle={SOURCE_LABEL[t.category_source]}
          value={picking ? 'Done' : 'Change'}
          onPress={() => setPicking((p) => !p)}
        />
        {picking
          ? CATEGORIES.map((cat) => (
              <Row
                key={cat}
                left={<CategoryTile category={cat} size={28} />}
                title={cat}
                checked={cat === t.category}
                onPress={() => {
                  setCategory(t.id, cat, applyAll);
                  setPicking(false);
                }}
              />
            ))
          : null}
        {t.payee_key ? (
          <SwitchRow
            title="Remember for this payee"
            subtitle={samePayee > 1 ? `Also updates ${samePayee - 1} other payment${samePayee > 2 ? 's' : ''}` : 'Future payments use it too'}
            value={applyAll}
            onValueChange={setApplyAll}
          />
        ) : null}
      </Section>

      <Why
        why={explainCategory(
          { direction: t.direction, channel: t.channel === 'cash' ? 'other' : t.channel, payee: t.payee, vpa: t.vpa, text: sms ?? '' },
          { category: t.category, source: t.category_source },
        )}
        onPick={(cat) => setCategory(t.id, cat, applyAll)}
      />

      <Section header="Note">
        <NoteField
          key={t.id}
          initial={t.note ?? ''}
          onSave={(note) => note !== (t.note ?? '') && updateTransaction(t.id, { note: note || null })}
        />
      </Section>

      <Section header="Details" inset={false}>
        {accountLabel(t) ? <Row title={t.direction === 'debit' ? 'Paid from' : 'Received in'} value={accountLabel(t)!} /> : null}
        {t.payee ? <Row title={t.direction === 'debit' ? 'Paid to' : 'From'} value={t.payee} /> : null}
        {t.vpa ? <Row title="UPI ID" value={t.vpa} /> : null}
        <Row title="Method" value={CHANNEL[t.channel] ?? t.channel} />
        {t.upi_ref ? <Row title="Reference" value={<Text color="secondaryLabel" selectable tabular>{t.upi_ref}</Text>} /> : null}
        <Row title="Source" value={t.source === 'sms' ? 'Bank SMS' : 'Added by hand'} />
      </Section>

      <Section footer="Hidden payments stay in Activity but don’t count towards totals.">
        <SwitchRow title="Hide from totals" value={t.hidden} onValueChange={(v) => updateTransaction(t.id, { hidden: v })} />
      </Section>

      {sms ? (
        <Section header="Original SMS">
          <Text variant="footnote" color="secondaryLabel" selectable style={styles.sms}>
            {sms}
          </Text>
        </Section>
      ) : null}
    </Screen>
  );
}

function NoteField({ initial, onSave }: { initial: string; onSave: (note: string) => void }) {
  const c = useColors();
  const [note, setNote] = useState(initial);
  return (
    <TextInput
      value={note}
      onChangeText={setNote}
      onBlur={() => onSave(note.trim())}
      placeholder="Add a note"
      placeholderTextColor={c.tertiaryLabel}
      multiline
      style={[type.body, styles.note, { color: c.label, fontFamily }]}
    />
  );
}

const styles = StyleSheet.create({
  why: { padding: layout.inset, gap: 12 },
  whyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  whyChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: 16 },
  head: { alignItems: 'center', paddingHorizontal: layout.inset, paddingTop: 16, paddingBottom: 28 },
  amount: { fontSize: 40, lineHeight: 48, fontWeight: '700', marginTop: 6 },
  note: { minHeight: 44, paddingHorizontal: layout.inset, paddingVertical: 11 },
  sms: { padding: layout.inset },
});
