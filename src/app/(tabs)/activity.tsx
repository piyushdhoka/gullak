import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { MonthSwitcher, parseMonthParam } from '@/components/month-switcher';
import { TxnRow } from '@/components/txn-row';
import { useData } from '@/lib/data';
import { dayLabel, money } from '@/lib/format';
import { groupByDay, inMonth, monthOf, type Month } from '@/lib/stats';
import { Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { fontFamily, layout, type, useColors } from '@/ui/theme';

export default function ActivityScreen() {
  const params = useLocalSearchParams<{ category?: string; month?: string }>();
  const { transactions, mode, refresh, refreshing } = useData();
  const c = useColors();
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

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = transactions.filter(
      (t) =>
        inMonth(t, month) &&
        (!category || t.category === category) &&
        (!q ||
          [t.merchant, t.payee, t.vpa, t.category, t.note, String(t.amount)]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))),
    );
    return groupByDay(list);
  }, [transactions, month, category, query]);

  return (
    <Screen title="Activity" onRefresh={mode === 'live' ? refresh : undefined} refreshing={refreshing}>
      <View style={[styles.search, { backgroundColor: c.fillTertiary }]}>
        <Text color="secondaryLabel">⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={c.secondaryLabel}
          autoCorrect={false}
          style={[type.body, styles.searchInput, { color: c.label, fontFamily }]}
        />
      </View>

      {category ? (
        <Pressable
          onPress={() => router.setParams({ category: undefined })}
          style={[styles.chip, { backgroundColor: `${c.tint}1F` }]}
          accessibilityLabel={`Remove ${category} filter`}>
          <Text variant="subheadline" weight="600" color="tint">
            {category} ✕
          </Text>
        </Pressable>
      ) : null}

      <MonthSwitcher month={month} onChange={setMonth} />

      {groups.length === 0 ? (
        <Text color="secondaryLabel" align="center" style={styles.empty}>
          {query || category ? 'No matching payments.' : 'No payments this month.'}
        </Text>
      ) : (
        groups.map((g) => (
          <Section
            key={g.day}
            header={`${dayLabel(g.date)}${g.spent ? ` · ${money(g.spent, { whole: true })} spent` : ''}`}>
            {g.items.map((t) => (
              <TxnRow key={t.id} t={t} />
            ))}
          </Section>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: layout.inset,
    marginBottom: 14,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
  },
  searchInput: { flex: 1, paddingVertical: 0, minWidth: 0 },
  chip: { alignSelf: 'flex-start', marginHorizontal: layout.inset, marginBottom: 14, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 },
  empty: { marginTop: 40 },
});
