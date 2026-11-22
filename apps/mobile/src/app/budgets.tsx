// Monthly budgets per category: set, change or remove a limit; see this month's progress.

import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CategoryTile } from '@/components/txn-row';
import { CATEGORIES, categoryMeta } from '@/lib/categories';
import { useData } from '@/lib/data';
import { money } from '@/lib/format';
import { budgetProgress, monthOf, summarize } from '@/lib/stats';
import { Button, Field } from '@/ui/controls';
import { Row, Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

const BUDGETABLE = CATEGORIES.filter((c) => !['Income', 'Refund', 'Transfers', 'Investments'].includes(c));

export default function BudgetsScreen() {
  const { transactions, budgets, setBudget } = useData();
  const s = useMemo(() => summarize(transactions, monthOf(new Date())), [transactions]);
  const progress = useMemo(() => budgetProgress(s, budgets), [s, budgets]);
  const [editing, setEditing] = useState<string | null>(null);
  const total = budgets.reduce((n, b) => n + b.monthly_limit, 0);
  const spentInBudgets = progress.reduce((n, p) => n + p.spent, 0);

  return (
    <Screen title="Budgets" largeTitle={false} back="Back" tabBar={false}>
      {budgets.length ? (
        <Section footer={`${money(spentInBudgets, { whole: true })} of ${money(total, { whole: true })} used this month across budgeted categories.`}>
          {progress.map((p) => (
            <BudgetRow key={p.category} category={p.category} limit={p.limit} spent={p.spent} warn={p.onPaceToExceed} onEdit={() => setEditing(p.category)} />
          ))}
        </Section>
      ) : (
        <Text variant="subheadline" color="secondaryLabel" style={styles.intro}>
          Pick a category and set a monthly limit. Gullak shows how much is left and warns you when you’re on pace to go over.
        </Text>
      )}

      {editing ? (
        <Editor
          key={editing}
          category={editing}
          current={budgets.find((b) => b.category === editing)?.monthly_limit ?? null}
          onDone={() => setEditing(null)}
          onSave={(v) => setBudget(editing, v)}
        />
      ) : null}

      <Section header="Add a budget">
        {BUDGETABLE.filter((c) => !budgets.some((b) => b.category === c)).map((cat) => (
          <Row
            key={cat}
            left={<CategoryTile category={cat} />}
            title={cat}
            value={s.byCategory.find((x) => x.category === cat) ? money(s.byCategory.find((x) => x.category === cat)!.amount, { whole: true }) : undefined}
            chevron
            onPress={() => setEditing(cat)}
          />
        ))}
      </Section>
    </Screen>
  );
}

function BudgetRow({ category, limit, spent, warn, onEdit }: { category: string; limit: number; spent: number; warn: boolean; onEdit: () => void }) {
  const c = useColors();
  const used = limit > 0 ? spent / limit : 0;
  const over = used > 1;
  const color = over ? c.red : warn ? c.orange : c[categoryMeta(category).color];
  return (
    <Row
      left={<CategoryTile category={category} />}
      title={
        <View style={{ gap: 6 }}>
          <View style={styles.top}>
            <Text style={{ flex: 1 }} numberOfLines={1}>
              {category}
            </Text>
            <Text tabular weight="500">
              {money(spent, { whole: true })}
              <Text color="secondaryLabel"> / {money(limit, { whole: true })}</Text>
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: c.fillTertiary }]}>
            <View style={{ width: `${Math.min(100, Math.max(2, used * 100))}%`, height: '100%', borderRadius: 3, backgroundColor: color }} />
          </View>
          <Text variant="caption1" color={over ? 'red' : warn ? 'orange' : 'secondaryLabel'}>
            {over
              ? `${money(spent - limit, { whole: true })} over`
              : warn
                ? `${money(limit - spent, { whole: true })} left · on pace to go over`
                : `${money(limit - spent, { whole: true })} left`}
          </Text>
        </View>
      }
      chevron
      onPress={onEdit}
    />
  );
}

function Editor({ category, current, onSave, onDone }: { category: string; current: number | null; onSave: (v: number | null) => void; onDone: () => void }) {
  const [value, setValue] = useState(current ? String(current) : '');
  const n = Number(value.replace(/[,\s₹]/g, ''));
  const ok = Number.isFinite(n) && n > 0 && n <= 1e8;
  return (
    <Section header={`${category} budget`}>
      <Field label="Per month ₹" value={value} onChangeText={(v) => setValue(v.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" placeholder="e.g. 5000" autoFocus />
      <View style={styles.editorButtons}>
        <Button
          title="Save"
          size="small"
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
  intro: { paddingHorizontal: layout.inset + 4, marginBottom: 24 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  editorButtons: { flexDirection: 'row', gap: 8, padding: 12 },
});
