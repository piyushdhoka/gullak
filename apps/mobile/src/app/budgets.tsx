// Monthly budgets per category: set, change or remove a limit; see this month's progress.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryTile } from '@/components/txn-row';
import { CATEGORIES } from '@/lib/categories';
import { useData } from '@/lib/data';
import { money, monthName } from '@/lib/format';
import { budgetProgress, monthOf, summarize, type BudgetProgress } from '@/lib/stats';
import { Button, Card, Field } from '@/ui/controls';
import { Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { MatkaBand, PixelBar, Sticker } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { layout, useColors, type ColorName } from '@/ui/theme';

const BUDGETABLE = CATEGORIES.filter((c) => !['Income', 'Refund', 'Transfers', 'Investments'].includes(c));

/** A budget's state in words, a symbol and a colour (never colour alone). */
function verdict(p: Pick<BudgetProgress, 'spent' | 'limit' | 'onPaceToExceed'>): { word: string; symbol: string; color: ColorName } {
  if (p.spent > p.limit) return { word: 'Over', symbol: '▲', color: 'red' };
  if (p.onPaceToExceed) return { word: 'Heading over', symbol: '!', color: 'orange' };
  return { word: 'On track', symbol: '✓', color: 'green' };
}

export default function BudgetsScreen() {
  const { transactions, budgets, setBudget } = useData();
  const s = useMemo(() => summarize(transactions, monthOf(new Date())), [transactions]);
  const progress = useMemo(() => budgetProgress(s, budgets), [s, budgets]);
  const [editing, setEditing] = useState<string | null>(null);
  const total = budgets.reduce((n, b) => n + b.monthly_limit, 0);
  const spentInBudgets = progress.reduce((n, p) => n + p.spent, 0);
  const spentIn = (cat: string) => s.byCategory.find((x) => x.category === cat)?.amount;
  const unbudgeted = BUDGETABLE.filter((c) => !budgets.some((b) => b.category === c));
  // The empty state suggests the category that cost the most this month.
  const suggestion = [...unbudgeted].sort((a, b) => (spentIn(b) ?? 0) - (spentIn(a) ?? 0))[0];

  const editor = (cat: string) => (
    <Editor
      key={cat}
      category={cat}
      spent={spentIn(cat) ?? 0}
      current={budgets.find((b) => b.category === cat)?.monthly_limit ?? null}
      onDone={() => setEditing(null)}
      onSave={(v) => setBudget(cat, v)}
    />
  );

  return (
    <Screen title="Budgets" largeTitle={false} back="Back" tabBar={false}>
      {budgets.length ? (
        <>
          <Hero spent={spentInBudgets} total={total} progress={progress} />
          <Text variant="footnote" weight="600" color="secondaryLabel" style={styles.header} accessibilityRole="header">
            This month, most used first
          </Text>
          <View style={styles.list}>
            {progress.map((p) =>
              editing === p.category ? (
                <View key={p.category}>{editor(p.category)}</View>
              ) : (
                <BudgetCard key={p.category} p={p} onEdit={() => setEditing(p.category)} />
              ),
            )}
          </View>
        </>
      ) : editing ? null : (
        <Empty suggestion={suggestion} spent={suggestion ? spentIn(suggestion) : undefined} onPick={setEditing} />
      )}

      {editing && !budgets.some((b) => b.category === editing) ? <View style={styles.newEditor}>{editor(editing)}</View> : null}

      {unbudgeted.length ? (
        <>
          <Text variant="footnote" weight="600" color="secondaryLabel" style={styles.header} accessibilityRole="header">
            Add a budget
          </Text>
          <View style={styles.picker}>
            {unbudgeted.map((cat) => {
              const amt = spentIn(cat);
              const on = editing === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setEditing(cat)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add a budget for ${cat}${amt ? `, ${money(amt, { whole: true })} spent this month` : ''}`}
                  accessibilityState={{ selected: on }}
                  style={styles.pick}>
                  {({ pressed }) => (
                    <Sticker pressed={pressed} radius={12} lift={on ? 0 : 2} style={styles.pickFace}>
                      <CategoryTile category={cat} size={28} />
                      <View style={styles.pickText}>
                        <Text variant="subheadline" weight="500" numberOfLines={1}>
                          {cat}
                        </Text>
                        <Text variant="caption1" color="secondaryLabel" numberOfLines={1}>
                          {amt ? `${money(amt, { whole: true })} so far` : 'Nothing yet'}
                        </Text>
                      </View>
                      <Text variant="headline" color="tint">
                        +
                      </Text>
                    </Sticker>
                  )}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function Hero({ spent, total, progress }: { spent: number; total: number; progress: BudgetProgress[] }) {
  const c = useColors();
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const left = total - spent;
  const over = progress.filter((p) => p.spent > p.limit).length;
  const close = progress.filter((p) => p.onPaceToExceed).length;
  const fine = progress.length - over - close;
  const tally = [over ? `${over} over` : null, close ? `${close} heading over` : null, fine ? `${fine} on track` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Card tone="clay" style={styles.hero}>
      <Text variant="subheadline" weight="600" style={{ color: c.onTint, opacity: 0.85 }}>
        {left >= 0 ? `Left to spend in ${monthName(monthOf(now))}` : `Over budget in ${monthName(monthOf(now))}`}
      </Text>
      <Text pixel style={[styles.heroAmount, { color: c.onTint }]} numberOfLines={1} adjustsFontSizeToFit>
        {left < 0 ? '▲ ' : ''}
        {money(Math.abs(left), { whole: true })}
      </Text>
      <Text variant="footnote" style={{ color: c.onTint, opacity: 0.85 }}>
        {money(spent, { whole: true })} of {money(total, { whole: true })} used · {daysLeft} day{daysLeft === 1 ? '' : 's'} to go
      </Text>
      <View style={styles.heroBar}>
        <PixelBar value={total > 0 ? spent / total : 0} color={c.cream} overColor={c.gold} height={10} />
      </View>
      <MatkaBand color={c.cream} style={styles.heroBand} />
      <View style={[styles.pill, { backgroundColor: c.cream, borderColor: c.outline }]}>
        <Text variant="footnote" weight="700" style={{ color: '#1C0F0C' }}>
          {tally}
        </Text>
      </View>
    </Card>
  );
}

function BudgetCard({ p, onEdit }: { p: BudgetProgress; onEdit: () => void }) {
  const c = useColors();
  const v = verdict(p);
  const used = p.limit > 0 ? p.spent / p.limit : 0;
  const barColor = v.color === 'green' ? c.green : c[v.color];
  const line =
    p.spent > p.limit
      ? `${money(p.spent - p.limit, { whole: true })} over the limit`
      : p.onPaceToExceed
        ? `${money(p.limit - p.spent, { whole: true })} left, but on pace to go over`
        : `${money(p.limit - p.spent, { whole: true })} left`;
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`${p.category}: ${money(p.spent, { whole: true })} of ${money(p.limit, { whole: true })}. ${v.word}, ${line}. Change budget`}>
      {({ pressed }) => (
        <Sticker pressed={pressed} radius={layout.radius} style={styles.card}>
          <View style={styles.cardTop}>
            <CategoryTile category={p.category} />
            <View style={styles.cardName}>
              <Text variant="headline" numberOfLines={1}>
                {p.category}
              </Text>
              <Text variant="caption1" color="secondaryLabel" numberOfLines={1}>
                Limit {money(p.limit, { whole: true })} a month
              </Text>
            </View>
            <View style={[styles.chip, { borderColor: c.outline, backgroundColor: c.cardElevated }]}>
              <Text variant="caption1" weight="700" color={v.color}>
                {v.symbol}
              </Text>
              <Text variant="caption1" weight="600">
                {v.word}
              </Text>
            </View>
          </View>
          <View style={styles.amountRow}>
            <Text pixel variant="title2" color={p.spent > p.limit ? 'red' : 'label'}>
              {money(p.spent, { whole: true })}
            </Text>
            <Text variant="footnote" color="secondaryLabel">
              {' '}
              spent · {Math.round(used * 100)}%
            </Text>
          </View>
          <PixelBar value={used} color={barColor} overColor={c.red} height={10} />
          <Text variant="footnote" weight="500" color={v.color === 'green' ? 'secondaryLabel' : v.color}>
            {line}
          </Text>
        </Sticker>
      )}
    </Pressable>
  );
}

function Empty({ suggestion, spent, onPick }: { suggestion?: string; spent?: number; onPick: (cat: string) => void }) {
  return (
    <Card style={styles.empty}>
      <Text variant="title3" weight="600">
        No limits yet
      </Text>
      <Text variant="subheadline" color="secondaryLabel">
        Pick the category that gets away from you. Gullak keeps count all month and warns you before it runs over.
      </Text>
      {suggestion ? (
        <>
          <Text variant="subheadline">
            {spent
              ? `${suggestion} is your biggest spend so far: ${money(spent, { whole: true })} this month.`
              : `${suggestion} is a good place to start.`}
          </Text>
          <Button title={`Set a ${suggestion} Budget`} onPress={() => onPick(suggestion)} style={{ marginTop: 6 }} />
        </>
      ) : null}
    </Card>
  );
}

function Editor({
  category,
  spent,
  current,
  onSave,
  onDone,
}: {
  category: string;
  spent: number;
  current: number | null;
  onSave: (v: number | null) => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState(current ? String(current) : '');
  const n = Number(value.replace(/[,\s₹]/g, ''));
  const ok = Number.isFinite(n) && n > 0 && n <= 1e8;
  return (
    <Section
      header={current ? `Change the ${category} budget` : `New ${category} budget`}
      footer={spent ? `${money(spent, { whole: true })} spent on ${category.toLowerCase()} so far this month.` : undefined}
      style={styles.editor}>
      <Field label="Per month ₹" value={value} onChangeText={(v) => setValue(v.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" placeholder="e.g. 5000" autoFocus />
      <View style={styles.editorButtons}>
        <Button
          title="Save"
          size="small"
          kind="filled"
          disabled={!ok}
          onPress={() => {
            onSave(Math.round(n * 100) / 100);
            onDone();
          }}
        />
        {current ? (
          <Button
            title="Remove"
            size="small"
            kind="plain"
            tint="red"
            onPress={() => {
              onSave(null);
              onDone();
            }}
          />
        ) : null}
        <Button title="Cancel" size="small" kind="plain" onPress={onDone} />
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  hero: { marginHorizontal: layout.inset, marginBottom: 24, gap: 2 },
  heroAmount: { fontSize: 44, lineHeight: 54, marginTop: 2 },
  heroBar: { marginTop: 12 },
  heroBand: { marginTop: 12, marginBottom: 12, marginHorizontal: -2 },
  pill: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  header: { paddingHorizontal: layout.inset * 2, paddingBottom: 7 },
  list: { paddingHorizontal: layout.inset, gap: 10, marginBottom: 28 },
  card: { padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardName: { flex: 1, minWidth: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 4 },
  empty: { marginHorizontal: layout.inset, marginBottom: 28, gap: 8 },
  editor: { marginHorizontal: 0, marginBottom: 0 },
  newEditor: { marginHorizontal: layout.inset, marginBottom: 28 },
  editorButtons: { flexDirection: 'row', gap: 8, padding: 12, flexWrap: 'wrap' },
  picker: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, paddingHorizontal: layout.inset, marginBottom: 32 },
  pick: { width: '48.5%' },
  pickFace: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 9, minHeight: 52 },
  pickText: { flex: 1, minWidth: 0 },
});
