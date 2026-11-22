import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { monthParam, MonthSwitcher } from '@/components/month-switcher';
import { CategoryTile, TxnRow } from '@/components/txn-row';
import { categoryMeta } from '@/lib/categories';
import { useData } from '@/lib/data';
import { money, monthName, shortMonth } from '@/lib/format';
import { addMonths, monthOf, summarize, type MonthSummary } from '@/lib/stats';
import { Button, Card } from '@/ui/controls';
import { Row, Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

export default function SummaryScreen() {
  const { transactions, review, mode, refresh, refreshing, loading } = useData();
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const s = useMemo(() => summarize(transactions, month), [transactions, month]);
  const empty = !loading && transactions.length === 0;

  return (
    <Screen title="Summary" onRefresh={mode === 'live' ? refresh : undefined} refreshing={refreshing}>
      {mode === 'demo' ? <DemoBanner /> : null}
      {review.length ? <ReviewBanner payees={review.length} payments={review.reduce((n, r) => n + r.count, 0)} /> : null}
      {empty ? (
        <EmptyState />
      ) : (
        <>
          <MonthSwitcher month={month} onChange={setMonth} />
          <Hero s={s} />
          <StatGrid s={s} />
          <DailyChart s={s} />
          <Categories s={s} />
          <Merchants s={s} />
          {s.biggest ? (
            <Section header="Biggest payment">
              <TxnRow t={s.biggest} showTime={false} />
            </Section>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function DemoBanner() {
  return (
    <Card style={styles.banner}>
      <Text variant="headline">Sample data</Text>
      <Text variant="subheadline" color="secondaryLabel" style={{ marginTop: 2, marginBottom: 12 }}>
        This is what your month will look like. Connect your account and Shortcut to see real payments.
      </Text>
      <Button title="Set Up Capture" kind="tinted" size="small" onPress={() => router.push('/setup')} style={{ alignSelf: 'flex-start' }} />
    </Card>
  );
}

function ReviewBanner({ payees, payments }: { payees: number; payments: number }) {
  const c = useColors();
  return (
    <Section style={{ marginBottom: 20 }}>
      <Row
        left={
          <View style={[styles.reviewDot, { backgroundColor: c.orange }]}>
            <Text weight="700" style={{ color: '#fff' }}>
              {payees}
            </Text>
          </View>
        }
        title={`${payees} new payee${payees === 1 ? '' : 's'} to sort`}
        subtitle={`${payments} payment${payments === 1 ? '' : 's'} · one tap each, remembered`}
        chevron
        onPress={() => router.push('/review')}
      />
    </Section>
  );
}

function EmptyState() {
  return (
    <Card style={styles.banner}>
      <Text display variant="title2">
        Your Gullak is empty
      </Text>
      <Text variant="subheadline" color="secondaryLabel" style={{ marginTop: 4, marginBottom: 14 }}>
        Set up the Shortcut once and every bank SMS shows up here within seconds.
      </Text>
      <Button title="Set Up Capture" onPress={() => router.push('/setup')} />
    </Card>
  );
}

function Hero({ s }: { s: MonthSummary }) {
  const c = useColors();
  const up = (s.changeVsLastMonth ?? 0) > 0;
  return (
    <Card style={styles.hero}>
      <Text variant="subheadline" color="secondaryLabel">
        Spent in {monthName(s.month)}
      </Text>
      <Text rounded tabular style={styles.heroAmount}>
        {money(s.spent, { whole: true })}
      </Text>
      {s.changeVsLastMonth != null ? (
        <View style={[styles.pill, { backgroundColor: `${up ? c.red : c.green}1F` }]}>
          <Text variant="footnote" weight="600" style={{ color: up ? c.red : c.green }}>
            {up ? '▲' : '▼'} {Math.abs(s.changeVsLastMonth)}%
          </Text>
          <Text variant="footnote" color="secondaryLabel">
            {s.projected != null ? 'vs same days last month' : `vs ${shortMonth(addMonths(s.month, -1))}`}
          </Text>
        </View>
      ) : (
        <Text variant="footnote" color="secondaryLabel">
          {s.count} payment{s.count === 1 ? '' : 's'}
        </Text>
      )}
    </Card>
  );
}

function Stat({ label, value, hint, tint }: { label: string; value: string; hint?: string; tint?: 'green' | 'red' }) {
  return (
    <View style={styles.statCell}>
      <Card style={styles.stat}>
        <Text variant="footnote" color="secondaryLabel">
          {label}
        </Text>
        <Text variant="title3" rounded tabular color={tint ?? 'label'} style={{ marginTop: 4 }} numberOfLines={1}>
          {value}
        </Text>
        {hint ? (
          <Text variant="caption1" color="secondaryLabel" style={{ marginTop: 2 }} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </Card>
    </View>
  );
}

function StatGrid({ s }: { s: MonthSummary }) {
  return (
    <View style={styles.grid}>
      <Stat label="Received" value={money(s.received, { whole: true })} tint="green" hint={`Net ${money(s.net, { whole: true })}`} />
      <Stat label="Daily average" value={money(s.dailyAverage, { whole: true })} hint={`over ${s.daysCounted} days`} />
      {s.projected != null ? (
        <Stat label="Projected" value={money(s.projected, { whole: true })} hint="by month end" />
      ) : (
        <Stat label="Payments" value={String(s.count)} hint="this month" />
      )}
      <Stat
        label="Monthly average"
        value={s.averageMonth != null ? money(s.averageMonth, { whole: true }) : '—'}
        hint="previous 3 months"
      />
    </View>
  );
}

function DailyChart({ s }: { s: MonthSummary }) {
  const c = useColors();
  const max = Math.max(...s.daily, 1);
  const today = s.projected != null ? s.daysCounted : -1;
  return (
    <Card style={styles.chartCard}>
      <View style={styles.chartHead}>
        <Text variant="footnote" color="secondaryLabel">
          Daily spend
        </Text>
        <Text variant="footnote" color="secondaryLabel" tabular>
          max {money(max, { whole: true })}
        </Text>
      </View>
      <View style={styles.chart}>
        {s.daily.map((v, i) => (
          <View key={i} style={styles.barSlot}>
            <View
              style={{
                height: `${Math.max(v > 0 ? 4 : 1.5, (v / max) * 100)}%`,
                borderRadius: 2,
                backgroundColor: i + 1 === today ? c.tint : v > 0 ? `${c.tint}80` : c.fillTertiary,
              }}
            />
          </View>
        ))}
      </View>
      <View style={styles.chartAxis}>
        {[1, 8, 15, 22, s.daily.length].map((d) => (
          <Text key={d} variant="caption2" color="tertiaryLabel">
            {d}
          </Text>
        ))}
      </View>
    </Card>
  );
}

function Categories({ s }: { s: MonthSummary }) {
  const c = useColors();
  if (!s.byCategory.length) return null;
  return (
    <Section header="Spending by category">
      {s.byCategory.map((cat) => (
        <Row
          key={cat.category}
          left={<CategoryTile category={cat.category} />}
          title={
            <View style={{ gap: 6 }}>
              <View style={styles.catTop}>
                <Text numberOfLines={1} style={{ flex: 1 }}>
                  {cat.category}
                </Text>
                <Text tabular weight="500">
                  {money(cat.amount, { whole: true })}
                </Text>
              </View>
              <View style={[styles.track, { backgroundColor: c.fillTertiary }]}>
                <View
                  style={{
                    width: `${Math.max(2, cat.share * 100)}%`,
                    height: '100%',
                    borderRadius: 3,
                    backgroundColor: c[categoryMeta(cat.category).color],
                  }}
                />
              </View>
              <Text variant="caption1" color="secondaryLabel">
                {Math.round(cat.share * 100)}% · {cat.count} payment{cat.count === 1 ? '' : 's'}
              </Text>
            </View>
          }
          chevron
          onPress={() => router.push({ pathname: '/activity', params: { category: cat.category, month: monthParam(s.month) } })}
        />
      ))}
    </Section>
  );
}

function Merchants({ s }: { s: MonthSummary }) {
  if (!s.topMerchants.length) return null;
  return (
    <Section header="Top merchants" inset={false}>
      {s.topMerchants.map((m, i) => (
        <Row
          key={m.name}
          title={`${i + 1}. ${m.name}`}
          subtitle={`${m.count} payment${m.count === 1 ? '' : 's'}`}
          value={
            <Text tabular weight="500">
              {money(m.amount, { whole: true })}
            </Text>
          }
        />
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  banner: { marginHorizontal: layout.inset, marginBottom: 20 },
  hero: { marginHorizontal: layout.inset, marginBottom: 12, alignItems: 'flex-start', gap: 4 },
  heroAmount: { fontSize: 44, lineHeight: 52, fontWeight: '700', letterSpacing: -0.5 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: layout.inset - 6, marginBottom: 12 },
  statCell: { width: '50%', padding: 6 },
  stat: { padding: 14 },
  chartCard: { marginHorizontal: layout.inset, marginBottom: 35 },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  chart: { height: 90, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  catTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  reviewDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
