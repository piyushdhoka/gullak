import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActivityEmpty, CategoryChips, DayHeader, SearchField } from '@/components/activity-filters';
import { MonthSwitcher, parseMonthParam } from '@/components/month-switcher';
import { TxnRow } from '@/components/txn-row';
import { CATEGORIES } from '@/lib/categories';
import { useData } from '@/lib/data';
import { dayLabel, money, monthName } from '@/lib/format';
import { groupByDay, inMonth, monthOf, type Month } from '@/lib/stats';
import { Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { layout } from '@/ui/theme';

const ORDER: string[] = [...CATEGORIES];

export default function ActivityScreen() {
  const params = useLocalSearchParams<{ category?: string; month?: string }>();
  const { transactions, mode, refresh, refreshing, loading } = useData();
  const [month, setMonth] = useState<Month>(() => parseMonthParam(params.month) ?? monthOf(new Date()));
  const [query, setQuery] = useState('');
  const category = params.category ?? null;

  // Arriving from Summary with ?month=… while this tab is already open.
  const [seenMonthParam, setSeenMonthParam] = useState(params.month);
  if (params.month !== seenMonthParam) {
    setSeenMonthParam(params.month);
    const m = parseMonthParam(params.month);
    if (m) setMonth(m);
  }

  const monthTxns = useMemo(() => transactions.filter((t) => inMonth(t, month)), [transactions, month]);

  // The chips: every category with a payment this month, in the usual order, plus the active filter.
  const chips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of monthTxns) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    if (category && !counts.has(category)) counts.set(category, 0);
    const rank = (cat: string) => (ORDER.includes(cat) ? ORDER.indexOf(cat) : ORDER.length);
    return [...counts.entries()]
      .map(([cat, count]) => ({ category: cat, count }))
      .sort((a, b) => rank(a.category) - rank(b.category) || a.category.localeCompare(b.category));
  }, [monthTxns, category]);

  const { groups, out, into, count } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = monthTxns.filter(
      (t) =>
        (!category || t.category === category) &&
        (!q ||
          [t.merchant, t.payee, t.vpa, t.category, t.note, String(t.amount)]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))),
    );
    let o = 0;
    let i = 0;
    for (const t of list) {
      if (t.hidden) continue;
      if (t.direction === 'debit') o += t.amount;
      else i += t.amount;
    }
    return { groups: groupByDay(list), out: o, into: i, count: list.length };
  }, [monthTxns, category, query]);

  const setCategory = (cat: string | null) => router.setParams({ category: cat ?? undefined });
  const filtered = !!(query.trim() || category);

  return (
    <Screen title="Activity" onRefresh={mode === 'live' ? refresh : undefined} refreshing={refreshing}>
      <SearchField value={query} onChange={setQuery} />
      <MonthSwitcher month={month} onChange={setMonth} />
      {chips.length > 1 || category ? <CategoryChips categories={chips} value={category} onChange={setCategory} /> : null}

      {count > 0 ? (
        <Text variant="footnote" color="secondaryLabel" style={styles.totals}>
          <Text pixel variant="footnote" color="label">
            {count}
          </Text>
          {` payment${count === 1 ? '' : 's'}`}
          {out > 0 ? (
            <>
              {'  ·  '}
              <Text pixel variant="footnote" color="label">
                {money(out, { whole: true })}
              </Text>
              {' out'}
            </>
          ) : null}
          {into > 0 ? (
            <>
              {'  ·  '}
              <Text pixel variant="footnote" color="green">
                +{money(into, { whole: true })}
              </Text>
              {' in'}
            </>
          ) : null}
        </Text>
      ) : null}

      {groups.length === 0 ? (
        loading ? null : filtered ? (
          <ActivityEmpty
            title="Nothing here"
            body={
              query.trim()
                ? `No ${category ? `${category} ` : ''}payment in ${monthName(month)} matches “${query.trim()}”. Try a shorter word, or another month.`
                : `No ${category} payments in ${monthName(month)}. Try another month, or see everything.`
            }
            action="Clear filters"
            onAction={() => {
              setQuery('');
              if (category) setCategory(null);
            }}
          />
        ) : (
          <ActivityEmpty
            title={`${monthName(month)} is empty`}
            body="Payments drop in here the moment your bank texts you. Paid in cash? Add it yourself."
            action="Add a cash payment"
            onAction={() => router.push('/add')}
            primary
          />
        )
      ) : (
        groups.map((g) => {
          const received = g.items.reduce((n, t) => (t.direction === 'credit' && !t.hidden ? n + t.amount : n), 0);
          return (
            <View key={g.day}>
              <DayHeader
                label={dayLabel(g.date)}
                spent={g.spent ? money(g.spent, { whole: true }) : null}
                received={received ? money(received, { whole: true }) : null}
              />
              <Section style={styles.group}>
                {g.items.map((t) => (
                  <TxnRow key={t.id} t={t} />
                ))}
              </Section>
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  totals: { marginHorizontal: layout.inset + layout.inset, marginBottom: 18 },
  group: { marginBottom: 22 },
});
