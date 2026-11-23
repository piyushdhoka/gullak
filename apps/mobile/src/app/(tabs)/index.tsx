import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { monthParam, MonthSwitcher } from '@/components/month-switcher';
import { JarCard } from '@/components/jar-card';
import { UnreadSms } from '@/components/unread-sms';
import { CategoryTile, MerchantTile, TxnRow } from '@/components/txn-row';
import { jarPlan } from '@gullak/core/jars.ts';
import { categoryMeta } from '@/lib/categories';
import { useData } from '@/lib/data';
import { canScanReceipts, pickReceiptPhoto, setPendingReceipt } from '@/lib/receipt-ocr';
import { pageMetadata } from '@/lib/seo';
import { money, monthName, shortMonth } from '@/lib/format';
import {
  addMonths,
  budgetProgress,
  monthOf,
  recurringMonthlyTotal,
  recurringPayments,
  sameMonth,
  summarize,
  trend,
  type Budget,
  type MonthSummary,
} from '@/lib/stats';
import { Button, Card } from '@/ui/controls';
import { Row, Section } from '@/ui/list';
import { Glyph, type GlyphName } from '@/ui/glyphs';
import { Screen } from '@/ui/screen';
import { Coin, MatkaBand, PixelBar, Sticker } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

// Static HTML for "/" is the public home page (signed-out visitors), so it carries the home metadata.
export const generateMetadata = () => pageMetadata('home');

export default function SummaryScreen() {
  const { transactions, review, mode, refresh, refreshing, loading, budgets } = useData();
  const [month, setMonth] = useState(() => monthOf(new Date()));
  const s = useMemo(() => summarize(transactions, month), [transactions, month]);
  const empty = !loading && transactions.length === 0;

  return (
    <Screen
      title="Summary"
      header={<Greeting />}
      onRefresh={mode === 'live' ? refresh : undefined}
      refreshing={refreshing}>
      <QuickActions review={review.length} payments={review.reduce((n, r) => n + r.count, 0)} />
      <UnreadSms />
      {mode === 'demo' ? <DemoBanner /> : null}
      {empty ? (
        <EmptyState />
      ) : (
        <>
          <MonthSwitcher month={month} onChange={setMonth} />
          <Hero s={s} />
          <StatGrid s={s} />
          <Budgets s={s} budgets={budgets} />
          <Jars />
          <DailyChart s={s} />
          <Trend s={s} />
          <Subscriptions />
          <Categories s={s} />
          <Merchants s={s} />
          {s.biggestAll.length ? (
            // Every payment that ties for the biggest amount, not just the first one found.
            <Section header={s.biggestAll.length > 1 ? 'Biggest payments' : 'Biggest payment'}>
              {s.biggestAll.slice(0, BIGGEST_SHOWN).map((t) => (
                <TxnRow key={t.id} t={t} showTime={false} />
              ))}
              {s.biggestAll.length > BIGGEST_SHOWN ? (
                <Row title={`${s.biggestAll.length - BIGGEST_SHOWN} more of ${money(s.biggestAll[0].amount)}`} chevron onPress={() => router.push('/activity')} />
              ) : null}
            </Section>
          ) : null}
        </>
      )}
    </Screen>
  );
}

/** Payments shown under "Biggest payments" when several tie; the rest are summed up in one row. */
const BIGGEST_SHOWN = 5;

function greeting(h: number) {
  if (h < 5) return 'Up late?';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** The home header: the mascot says hello instead of a plain "Summary" title. */
function Greeting() {
  const c = useColors();
  return (
    <View style={styles.greet}>
      <View style={[styles.greetAvatar, { backgroundColor: c.cream, borderColor: c.outline }]}>
        <Image source={require('../../../assets/images/logo-192.png')} style={styles.greetMascot} contentFit="contain" />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="subheadline" color="secondaryLabel">
          {greeting(new Date().getHours())}
        </Text>
        <Text display style={styles.greetTitle} accessibilityRole="header">
          Your Gullak
        </Text>
      </View>
      {canScanReceipts ? <ScanButton /> : null}
    </View>
  );
}

/** Top right of home: opens the camera to scan a bill; the Add screen then reads it and fills itself in. */
function ScanButton() {
  const c = useColors();
  const scan = () => {
    // Opens the picker synchronously inside the tap (browsers only allow it from a tap).
    pickReceiptPhoto({ camera: true }).then((file) => {
      if (!file) return;
      setPendingReceipt(file);
      router.push('/add?receipt=1');
    });
  };
  return (
    <Pressable onPress={scan} accessibilityRole="button" accessibilityLabel="Scan a receipt" hitSlop={6}>
      {({ pressed }) => (
        <Sticker color={c.card} radius={14} pressed={pressed} style={styles.scanButton}>
          <Glyph name="camera" size={26} color={c.tint} />
        </Sticker>
      )}
    </Pressable>
  );
}

/** Three big tappable stickers: the things you do most, one tap away. */
function QuickActions({ review, payments }: { review: number; payments: number }) {
  const c = useColors();
  const items: { key: string; label: string; hint: string; icon: GlyphName; onPress: () => void; badge?: number; tone?: 'clay' | 'gold' }[] = [
    { key: 'budgets', label: 'Budgets', hint: 'What’s left', icon: 'target', onPress: () => router.push('/budgets'), tone: 'clay' },
    review
      ? {
          key: 'review',
          label: `Sort ${review}`,
          hint: `${payments} payment${payments === 1 ? '' : 's'} waiting`,
          icon: 'question',
          onPress: () => router.push('/review'),
          badge: review,
          tone: 'gold',
        }
      : { key: 'jars', label: 'Jars', hint: 'Save for something', icon: 'jar', onPress: () => router.push('/jars') },
    { key: 'add', label: 'Add cash', hint: 'Chai, auto, tips', icon: 'coin', onPress: () => router.push('/add') },
  ];
  return (
    <View style={styles.quick}>
      {items.map((it) => {
        const bg = it.tone === 'clay' ? c.tint : it.tone === 'gold' ? c.gold : c.card;
        const fg = it.tone === 'clay' ? c.onTint : it.tone === 'gold' ? '#1C0F0C' : c.label;
        return (
          <Pressable
            key={it.key}
            onPress={it.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${it.label}. ${it.hint}`}
            style={styles.quickCell}>
            {({ pressed }) => (
              <Sticker color={bg} radius={14} pressed={pressed} style={styles.quickCard}>
                <View style={styles.quickIcon}>
                  <Glyph name={it.icon} size={26} color={fg} />
                </View>
                <Text variant="subheadline" weight="700" numberOfLines={1} style={{ color: fg }}>
                  {it.label}
                </Text>
                <Text variant="caption1" numberOfLines={1} style={{ color: fg, opacity: 0.75 }}>
                  {it.hint}
                </Text>
              </Sticker>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function Jars() {
  const { jars, jarEntries, transactions } = useData();
  if (!jars.length) {
    return (
      <Section>
        <Row title="Start a Gullak Jar" subtitle="Save for a trip, a phone, anything" chevron onPress={() => router.push('/jars')} />
      </Section>
    );
  }
  return (
    <View style={{ marginBottom: 24 }}>
      <Text variant="footnote" weight="600" color="secondaryLabel" style={styles.jarsHead} accessibilityRole="header">
        Gullak Jars
      </Text>
      {jars.slice(0, 2).map((j) => {
        const p = jarPlan(j, jarEntries, transactions);
        return (
          <JarCard
            key={j.id}
            emoji={j.emoji ?? '🐷'}
            name={j.name}
            saved={p.saved}
            target={j.target}
            progress={p.progress}
            line={p.perWeek != null ? `${money(p.perWeek, { whole: true })} a week${p.status === 'behind' ? ' · behind' : ''}` : p.status === 'done' ? 'Full!' : `${money(p.left, { whole: true })} to go`}
            warn={p.status === 'behind'}
            onPress={() => router.push({ pathname: '/jar', params: { id: j.id } })}
          />
        );
      })}
      <Pressable onPress={() => router.push('/jars')} accessibilityRole="button" style={styles.jarsAll}>
        <Text color="tint" variant="subheadline">
          {jars.length > 2 ? `All ${jars.length} jars` : 'All jars'}
        </Text>
      </Pressable>
    </View>
  );
}

function Budgets({ s, budgets }: { s: MonthSummary; budgets: Budget[] }) {
  const c = useColors();
  if (!budgets.length) {
    return (
      <Section>
        <Row title="Set a monthly budget" subtitle="See what is left in each category" chevron onPress={() => router.push('/budgets')} />
      </Section>
    );
  }
  const progress = budgetProgress(s, budgets).slice(0, 4);
  return (
    <Section header="Budgets">
      {progress.map((p) => {
        const over = p.used > 1;
        const color = over ? c.red : p.onPaceToExceed ? c.orange : c[categoryMeta(p.category).color];
        return (
          <Row
            key={p.category}
            left={<CategoryTile category={p.category} />}
            title={
              <View style={{ gap: 6 }}>
                <View style={styles.catTop}>
                  <Text numberOfLines={1} style={{ flex: 1 }}>
                    {p.category}
                  </Text>
                  <Text variant="footnote" color={over ? 'red' : p.onPaceToExceed ? 'orange' : 'secondaryLabel'} tabular>
                    {over ? `${money(-p.left, { whole: true })} over` : `${money(p.left, { whole: true })} left`}
                  </Text>
                </View>
                <PixelBar value={p.used} color={color} />
              </View>
            }
          />
        );
      })}
      <Row title="All budgets" tint="tint" chevron onPress={() => router.push('/budgets')} />
    </Section>
  );
}

function Trend({ s }: { s: MonthSummary }) {
  const c = useColors();
  const { transactions } = useData();
  const points = trend(transactions, s.month, 6);
  const max = Math.max(...points.map((p) => p.spent), 1);
  const earlier = points.slice(0, -1).filter((p) => p.spent > 0);
  const avg = earlier.length ? earlier.reduce((n, p) => n + p.spent, 0) / earlier.length : null;
  return (
    <Card style={styles.chartCard}>
      <View style={styles.chartHead}>
        <Text variant="footnote" color="secondaryLabel">
          Last 6 months
        </Text>
        <Text variant="footnote" color="secondaryLabel" tabular>
          {avg != null ? `avg ${money(avg, { whole: true })}` : ''}
        </Text>
      </View>
      <View style={styles.trend}>
        {points.map((p) => {
          const current = sameMonth(p.month, s.month);
          return (
            <View key={`${p.month.year}-${p.month.month}`} style={styles.trendSlot}>
              <Text pixel variant="caption1" color={current ? 'label' : 'secondaryLabel'} numberOfLines={1}>
                {p.spent >= 1000 ? `${Math.round(p.spent / 1000)}k` : String(Math.round(p.spent))}
              </Text>
              <View style={styles.trendBarArea}>
                <View
                  style={{
                    height: `${Math.max(p.spent > 0 ? 4 : 1.5, (p.spent / max) * 100)}%`,
                    borderRadius: 3,
                    backgroundColor: current ? c.tint : p.spent > 0 ? `${c.tint}59` : c.fillTertiary,
                    borderWidth: current ? 2 : 0,
                    borderColor: c.outline,
                  }}
                />
              </View>
              <Text variant="caption2" color={current ? 'label' : 'tertiaryLabel'} weight={current ? '600' : '400'}>
                {shortMonth(p.month)}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function Subscriptions() {
  const { transactions } = useData();
  const items = recurringPayments(transactions);
  if (!items.length) return null;
  const total = recurringMonthlyTotal(items);
  return (
    <Section header="Subscriptions & repeats">
      {items.slice(0, 3).map((r) => (
        <Row
          key={r.key}
          left={<MerchantTile name={r.name} category={r.category} />}
          title={r.name}
          subtitle={`Next around ${r.next.getDate()} ${shortMonth(monthOf(r.next))}`}
          value={money(r.amount, { whole: true })}
        />
      ))}
      <Row
        title={`${money(total, { whole: true })} every month`}
        subtitle={`${items.length} repeating payment${items.length === 1 ? '' : 's'}`}
        tint="tint"
        chevron
        onPress={() => router.push('/subscriptions')}
      />
    </Section>
  );
}

function DemoBanner() {
  const c = useColors();
  return (
    <Pressable onPress={() => router.push('/setup')} accessibilityRole="button" accessibilityLabel="Sample data. Set up capture to see real payments">
      {({ pressed }) => (
        <View style={[styles.demo, { borderColor: c.outline, backgroundColor: pressed ? c.fill : c.fillTertiary }]}>
          <Text variant="footnote" style={{ flex: 1 }}>
            <Text variant="footnote" weight="700">
              Sample data.{' '}
            </Text>
            Set up capture to fill this with your real payments.
          </Text>
          <Text variant="footnote" weight="700" color="tint">
            Set up
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function EmptyState() {
  const c = useColors();
  return (
    <Card tone="clay" style={styles.banner}>
      <Text display variant="title2" style={{ color: c.onTint }}>
        Your Gullak is empty
      </Text>
      <MatkaBand color={c.cream} style={{ marginVertical: 10, opacity: 0.9 }} />
      <Text variant="subheadline" style={{ color: c.onTint, marginBottom: 16 }}>
        Not a single coin yet. Set up capture once and every bank SMS drops in here within seconds.
      </Text>
      <Button title="Set Up Capture" kind="gray" onPress={() => router.push('/setup')} style={{ backgroundColor: c.cream }} />
    </Card>
  );
}

// The pot: the month's spend painted on clay, with the cream wave band from the mascot's belly.
function Hero({ s }: { s: MonthSummary }) {
  const c = useColors();
  const up = (s.changeVsLastMonth ?? 0) > 0;
  return (
    <Card tone="clay" style={styles.hero}>
      <View style={styles.heroTop}>
        <Text variant="subheadline" weight="600" style={{ color: c.onTint, opacity: 0.85 }}>
          Spent in {monthName(s.month)}
        </Text>
        <Coin size={26} />
      </View>
      <Text pixel style={[styles.heroAmount, { color: c.onTint }]}>
        {money(s.spent, { whole: true })}
      </Text>
      <MatkaBand color={c.cream} style={styles.heroBand} />
      {s.changeVsLastMonth != null ? (
        <View style={styles.heroFoot}>
          <View style={[styles.pill, { backgroundColor: c.cream, borderColor: c.outline }]}>
            <Text variant="footnote" weight="700" style={{ color: up ? '#A8341A' : '#1F6E1D' }}>
              {up ? '▲' : '▼'} {Math.abs(s.changeVsLastMonth)}%
            </Text>
          </View>
          <Text variant="footnote" style={{ color: c.onTint, opacity: 0.85, flexShrink: 1 }}>
            {s.projected != null ? 'vs the same days last month' : `vs ${shortMonth(addMonths(s.month, -1))}`}
          </Text>
        </View>
      ) : (
        <Text variant="footnote" style={{ color: c.onTint, opacity: 0.85 }}>
          {s.count} payment{s.count === 1 ? '' : 's'}
        </Text>
      )}
    </Card>
  );
}

function Stat({ label, value, hint, tint }: { label: string; value: string; hint?: string; tint?: 'green' | 'red' }) {
  return (
    <View style={styles.statCell}>
      <Text variant="footnote" color="secondaryLabel">
        {label}
      </Text>
      <Text pixel variant="title3" color={tint ?? 'label'} style={{ marginTop: 2 }} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text variant="caption1" color="secondaryLabel" style={{ marginTop: 1 }} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

// Four numbers in one outlined block, split by hairlines: they're read together, not tapped.
function StatGrid({ s }: { s: MonthSummary }) {
  const c = useColors();
  const line = { backgroundColor: c.separator };
  return (
    <Sticker style={styles.grid} radius={layout.radius}>
      <View style={styles.gridRow}>
        <Stat label="Received" value={money(s.received, { whole: true })} tint="green" hint={`Net ${money(s.net, { whole: true })}`} />
        <View style={[styles.vLine, line]} />
        <Stat label="Daily average" value={money(s.dailyAverage, { whole: true })} hint={`over ${s.daysCounted} days`} />
      </View>
      <View style={[styles.hLine, line]} />
      <View style={styles.gridRow}>
        {s.projected != null ? (
          <Stat label="Projected" value={money(s.projected, { whole: true })} hint="by month end" />
        ) : (
          <Stat label="Payments" value={String(s.count)} hint="this month" />
        )}
        <View style={[styles.vLine, line]} />
        <Stat
          label="Monthly average"
          value={s.averageMonth != null ? money(s.averageMonth, { whole: true }) : '—'}
          hint="previous 3 months"
        />
      </View>
    </Sticker>
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
                borderRadius: 1,
                backgroundColor: i + 1 === today ? c.gold : v > 0 ? `${c.tint}99` : c.fillTertiary,
                borderWidth: i + 1 === today ? 1.5 : 0,
                borderColor: c.outline,
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
              <PixelBar value={cat.share} color={c[categoryMeta(cat.category).color]} />
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
  greet: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: layout.inset + 2, paddingTop: 4, paddingBottom: 16 },
  greetAvatar: { width: 54, height: 54, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  greetMascot: { width: 50, height: 50 },
  greetTitle: { fontSize: 32, lineHeight: 38 },
  scanButton: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  quick: { flexDirection: 'row', gap: 8, marginHorizontal: layout.inset, marginBottom: 16 },
  quickCell: { flex: 1, minWidth: 0 },
  quickCard: { paddingVertical: 12, paddingHorizontal: 10, gap: 2, minHeight: 92 },
  quickIcon: { height: 28, justifyContent: 'center', marginBottom: 4 },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: layout.inset,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  hero: { marginHorizontal: layout.inset, marginBottom: 14, paddingTop: 14, paddingBottom: 16, gap: 2 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroAmount: { fontSize: 54, lineHeight: 62 },
  heroBand: { marginTop: 4, marginBottom: 12, opacity: 0.9 },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 7, paddingVertical: 2 },
  grid: { marginHorizontal: layout.inset, marginBottom: 20 },
  gridRow: { flexDirection: 'row' },
  statCell: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  vLine: { width: StyleSheet.hairlineWidth * 2 },
  hLine: { height: StyleSheet.hairlineWidth * 2 },
  chartCard: { marginHorizontal: layout.inset, marginBottom: 35 },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  chart: { height: 90, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  catTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewDot: { width: 30, height: 30, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  jarsHead: { marginHorizontal: layout.inset + 16, marginBottom: 6 },
  jarsAll: { marginHorizontal: layout.inset + 16, marginTop: -4 },
  trend: { height: 130, flexDirection: 'row', gap: 8 },
  trendSlot: { flex: 1, alignItems: 'center', gap: 4 },
  trendBarArea: { flex: 1, width: '100%', justifyContent: 'flex-end' },
});
