import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { explainCategory, type Explanation } from '@gullak/core';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CategoryTile } from '@/components/txn-row';
import { CATEGORIES } from '@/lib/categories';
import { useData } from '@/lib/data';
import { accountLabel, displayName, fullDate, signedMoney } from '@/lib/format';
import { isDemo, supabase } from '@/lib/api';
import { Row, Section, SwitchRow } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { PixelBar, Sticker } from '@/ui/sticker';
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
  model: 'Guessed by Gullak. Check it',
  unknown: 'Pick one below. Gullak remembers it for this payee',
};

type Odds = { category: string; p: number }[];

// One answer per payee per session: the same payee gets the same odds.
const oddsCache = new Map<string, Odds | null>();

/** The AI's odds for each category of this payment (null when it can't judge, e.g. a QR code). */
function useOdds(id: string | undefined, payeeKey: string | null | undefined): Odds | null {
  const key = payeeKey ?? id ?? '';
  const [odds, setOdds] = useState<Odds | null>(() => oddsCache.get(key) ?? null);
  useEffect(() => {
    if (isDemo || !id || oddsCache.has(key)) return;
    let alive = true;
    supabase.functions
      .invoke<{ odds: Odds | null }>('why', { body: { transaction_id: id } })
      .then(({ data }) => {
        const value = data?.odds?.length ? data.odds : null;
        oddsCache.set(key, value);
        if (alive) setOdds(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id, key]);
  return odds;
}

const pct = (p: number) => (p >= 0.995 ? '99%' : p < 0.01 ? '<1%' : `${Math.round(p * 100)}%`);

/** The torn bottom edge of a paper bill. Stretches to its box. */
function Zigzag({ color, outline }: { color: string; outline: string }) {
  const teeth = 18;
  const w = teeth * 12;
  let fill = 'M0 0';
  let line = 'M0 1';
  for (let i = 0; i < teeth; i++) {
    fill += ` L${i * 12 + 6} 9 L${i * 12 + 12} 0`;
    line += ` L${i * 12 + 6} 9 L${i * 12 + 12} 1`;
  }
  return (
    <Svg width="100%" height={11} viewBox={`0 0 ${w} 11`} preserveAspectRatio="none" style={{ marginTop: -1 }}>
      <Path d={`${fill} Z`} fill={color} />
      <Path d={line} stroke={outline} strokeWidth={2} fill="none" strokeLinejoin="miter" />
    </Svg>
  );
}

/** A row of dashes, like the perforation on a receipt. */
function Perforation() {
  const c = useColors();
  return (
    <View style={styles.perf} accessible={false}>
      {Array.from({ length: 28 }, (_, i) => (
        <View key={i} style={[styles.perfDash, { backgroundColor: c.separator }]} />
      ))}
    </View>
  );
}

/** "Why?": the reason for the category, the AI's odds when there are any, and one-tap fixes. */
function Why({ why, odds, current, onPick }: { why: Explanation; odds: Odds | null; current: string; onPick: (category: string) => void }) {
  const c = useColors();
  const options: { category: string; p?: number }[] = odds
    ? odds.slice(0, 4)
    : [{ category: current }, ...why.alternatives.filter((x) => x !== current).map((category) => ({ category }))].slice(0, 4);
  return (
    <Section header="Why this category?">
      <View style={styles.why}>
        <Text variant="subheadline">{why.reason}</Text>
        {odds ? (
          <Text variant="footnote" color="secondaryLabel">
            How sure Gullak’s AI is. Tap another to switch.
          </Text>
        ) : (
          <Text variant="footnote" color="secondaryLabel">
            Not right? Tap the one it should be.
          </Text>
        )}
        <View style={{ gap: 6 }}>
          {options.map(({ category, p }) => {
            const selected = category === current;
            return (
              <Pressable
                key={category}
                onPress={() => !selected && onPick(category)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${category}${p != null ? `, ${pct(p)}` : ''}${selected ? ', current category' : ', switch to this'}`}
                style={({ pressed }) => [
                  styles.option,
                  { borderColor: selected ? c.outline : c.separator, backgroundColor: selected ? `${c.tint}14` : 'transparent' },
                  pressed && !selected && { backgroundColor: c.fillTertiary },
                ]}>
                <CategoryTile category={category} size={26} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.optionTop}>
                    <Text variant="subheadline" weight={selected ? '700' : '500'} style={{ flex: 1 }}>
                      {category}
                    </Text>
                    {p != null ? (
                      <Text pixel variant="subheadline" color={selected ? 'tint' : 'secondaryLabel'}>
                        {pct(p)}
                      </Text>
                    ) : selected ? (
                      <Text variant="footnote" weight="600" color="tint">
                        Current
                      </Text>
                    ) : null}
                  </View>
                  {p != null ? <PixelBar value={p} color={selected ? c.tint : c.gray} height={6} blocks={24} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Section>
  );
}

export default function TransactionScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, setCategory, updateTransaction } = useData();
  const t = transactions.find((x) => x.id === id);

  const [picking, setPicking] = useState(false);
  const [applyAll, setApplyAll] = useState(true);
  const [sms, setSms] = useState<string | null>(null);
  const odds = useOdds(t?.id, t?.payee_key);

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
        <View style={styles.missing}>
          <Text pixel variant="title2" align="center">
            Hmm, no coin here
          </Text>
          <Text color="secondaryLabel" align="center">
            This payment isn’t loaded. Pull down on Activity to refresh, then try again.
          </Text>
        </View>
      </Screen>
    );
  }

  const samePayee = t.payee_key ? transactions.filter((x) => x.payee_key === t.payee_key).length : 0;
  const needsCategory = t.category_source === 'unknown';
  const credit = t.direction === 'credit';

  return (
    <Screen title={displayName(t)} largeTitle={false} back="Back" tabBar={false}>
      {/* The receipt: the one bold thing on this screen. */}
      <View style={styles.receiptWrap}>
        <Sticker radius={16} style={styles.receipt} lift={0}>
          <View style={styles.receiptTop}>
            <CategoryTile category={needsCategory ? 'Other' : t.category} size={56} />
            <Text pixel variant="title2" align="center" numberOfLines={2} style={{ marginTop: 10 }}>
              {displayName(t)}
            </Text>
            <Text variant="footnote" color="secondaryLabel" align="center">
              {fullDate(t.occurred_at)}
            </Text>
            <Text
              pixel
              color={credit ? 'green' : 'label'}
              style={[styles.amount, t.hidden && { opacity: 0.4, textDecorationLine: 'line-through' }]}
              accessibilityLabel={`${credit ? 'Received' : 'Paid'} ${signedMoney(t).slice(1)}`}>
              {signedMoney(t)}
            </Text>
            {t.hidden ? (
              <Text variant="footnote" weight="600" color="secondaryLabel">
                Hidden from totals
              </Text>
            ) : null}
          </View>

          <Perforation />

          <Pressable
            onPress={() => setPicking((p) => !p)}
            accessibilityRole="button"
            accessibilityLabel={`Category ${needsCategory ? 'not set' : t.category}. ${picking ? 'Close the list' : 'Change it'}`}
            style={({ pressed }) => [styles.catRow, pressed && { backgroundColor: c.fillTertiary }]}>
            <View style={{ flex: 1 }}>
              <Text variant="footnote" color="secondaryLabel">
                Category
              </Text>
              <Text variant="headline" color={needsCategory ? 'orange' : 'label'}>
                {needsCategory ? 'Needs a category' : t.category}
              </Text>
              {SOURCE_LABEL[t.category_source] ? (
                <Text variant="caption1" color="secondaryLabel">
                  {SOURCE_LABEL[t.category_source]}
                </Text>
              ) : null}
            </View>
            <View style={[styles.changeChip, { borderColor: c.outline, backgroundColor: picking ? c.tint : 'transparent' }]}>
              <Text variant="footnote" weight="700" style={{ color: picking ? c.onTint : c.label }}>
                {picking ? 'Done' : 'Change'}
              </Text>
            </View>
          </Pressable>

          {picking ? (
            <View style={styles.grid}>
              {CATEGORIES.map((cat) => {
                const selected = cat === t.category && !needsCategory;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      setCategory(t.id, cat, applyAll);
                      setPicking(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={cat}
                    style={({ pressed }) => [
                      styles.tile,
                      { borderColor: selected ? c.outline : c.separator, backgroundColor: selected ? `${c.tint}1F` : c.card },
                      pressed && { backgroundColor: c.fillTertiary },
                    ]}>
                    <CategoryTile category={cat} size={30} />
                    <Text variant="caption1" weight={selected ? '700' : '500'} numberOfLines={1}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Sticker>
        <Zigzag color={c.card} outline={c.outline} />
      </View>

      {t.payee_key ? (
        <Section>
          <SwitchRow
            title="Remember for this payee"
            subtitle={samePayee > 1 ? `Also updates ${samePayee - 1} other payment${samePayee > 2 ? 's' : ''}` : 'Future payments use it too'}
            value={applyAll}
            onValueChange={setApplyAll}
          />
        </Section>
      ) : null}

      <Why
        why={explainCategory(
          { direction: t.direction, channel: t.channel === 'cash' ? 'other' : t.channel, payee: t.payee, vpa: t.vpa, text: sms ?? '' },
          { category: t.category, source: t.category_source },
        )}
        odds={odds}
        current={t.category}
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
      placeholder="Add a note, like “Goa trip dinner”"
      placeholderTextColor={c.placeholder}
      accessibilityLabel="Note"
      multiline
      selectionColor={c.tint}
      style={[type.body, styles.note, { color: c.label, fontFamily, backgroundColor: c.cardElevated, borderColor: c.separator }]}
    />
  );
}

const styles = StyleSheet.create({
  missing: { paddingHorizontal: layout.inset * 2, paddingTop: 60, gap: 8 },
  receiptWrap: { marginHorizontal: layout.inset, marginTop: 8, marginBottom: 28 },
  receipt: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  receiptTop: { alignItems: 'center', paddingHorizontal: layout.inset, paddingTop: 20, paddingBottom: 18, gap: 2 },
  amount: { fontSize: 46, lineHeight: 56, marginTop: 8 },
  perf: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14 },
  perfDash: { width: 6, height: 2, borderRadius: 1 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: layout.inset, paddingVertical: 14 },
  changeChip: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 14 },
  tile: {
    width: '23%',
    flexGrow: 1,
    minWidth: 72,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  why: { padding: layout.inset, gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1.5 },
  optionTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  note: { minHeight: 72, margin: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 2, textAlignVertical: 'top' },
  sms: { padding: layout.inset },
});
