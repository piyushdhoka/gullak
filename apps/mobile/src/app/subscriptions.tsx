// Subscriptions and other repeating payments (rent, SIPs, EMIs), found in your history automatically.

import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { CategoryTile } from '@/components/txn-row';
import { useData } from '@/lib/data';
import { dayLabel, money } from '@/lib/format';
import { recurringMonthlyTotal, recurringPayments } from '@/lib/stats';
import { Card } from '@/ui/controls';
import { Row, Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { layout } from '@/ui/theme';

export default function SubscriptionsScreen() {
  const { transactions } = useData();
  const items = useMemo(() => recurringPayments(transactions), [transactions]);
  const total = recurringMonthlyTotal(items);

  return (
    <Screen title="Subscriptions" largeTitle={false} back="Back" tabBar={false}>
      <Card style={styles.hero}>
        <Text variant="subheadline" color="secondaryLabel">
          Repeating every month
        </Text>
        <Text rounded tabular style={styles.amount}>
          {money(total, { whole: true })}
        </Text>
        <Text variant="footnote" color="secondaryLabel">
          {items.length} payment{items.length === 1 ? '' : 's'} · {money(total * 12, { whole: true })} a year
        </Text>
      </Card>

      {items.length ? (
        <Section footer="Same payee, about the same amount, at least 3 different months. Rent you pay in cash counts too if you add it each month.">
          {items.map((r) => (
            <Row
              key={r.key}
              left={<CategoryTile category={r.category} />}
              title={r.name}
              subtitle={`Next around ${dayLabel(r.next)} · ${r.months} months`}
              value={
                <Text tabular weight="500">
                  {money(r.amount, { whole: true })}
                </Text>
              }
            />
          ))}
        </Section>
      ) : (
        <Text variant="subheadline" color="secondaryLabel" style={styles.empty}>
          Nothing repeating yet. Subscriptions, rent, SIPs and EMIs show up here after they’ve been paid in 3 different months.
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginHorizontal: layout.inset, marginBottom: 24, gap: 2 },
  amount: { fontSize: 38, lineHeight: 46, fontWeight: '700' },
  empty: { paddingHorizontal: layout.inset + 4 },
});
