// Subscriptions and other repeating payments (rent, SIPs, EMIs), found in your history automatically.
// The monthly total on clay, then what's coming up as a stack of tickets, soonest first.

import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { MerchantTile } from '@/components/txn-row';
import { useData } from '@/lib/data';
import { money, shortDate } from '@/lib/format';
import { recurringMonthlyTotal, recurringPayments, type Recurring } from '@/lib/stats';
import { Button, Card } from '@/ui/controls';
import { Screen } from '@/ui/screen';
import { Coin, MatkaBand, Sticker } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

const DAY = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Whole days from today to `d` (negative once it has passed). */
function daysUntil(d: Date, now = new Date()) {
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((start(d) - start(now)) / DAY);
}

function when(days: number, next: Date) {
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1) return `In ${days} days`;
  return `Expected ${shortDate(next)}, not seen yet`;
}

export default function SubscriptionsScreen() {
  const { transactions } = useData();
  const items = useMemo(() => recurringPayments(transactions), [transactions]);
  const total = recurringMonthlyTotal(items);
  const upcoming = useMemo(() => [...items].sort((a, b) => a.next.getTime() - b.next.getTime()), [items]);
  const soonest = upcoming.find((r) => daysUntil(r.next) >= 0);
  const nextWeek = upcoming.filter((r) => {
    const d = daysUntil(r.next);
    return d >= 0 && d <= 7;
  });

  return (
    <Screen title="Subscriptions" largeTitle={false} back="Back" tabBar={false}>
      {items.length ? (
        <>
          <Hero total={total} count={items.length} weekTotal={nextWeek.reduce((n, r) => n + r.amount, 0)} weekCount={nextWeek.length} />
          <Text variant="footnote" weight="600" color="secondaryLabel" style={styles.header} accessibilityRole="header">
            Coming up
          </Text>
          <View style={styles.tickets}>
            {upcoming.map((r) => (
              <Ticket key={r.key} r={r} first={r.key === soonest?.key} />
            ))}
          </View>
          <Text variant="footnote" color="secondaryLabel" style={styles.footer}>
            Same payee, about the same amount, at least 3 different months. Rent you pay in cash counts too if you add it each month.
          </Text>
        </>
      ) : (
        <Card style={styles.empty}>
          <View style={styles.emptyCoins} accessible={false}>
            <Coin size={26} />
            <Coin size={26} />
            <Coin size={26} />
          </View>
          <Text variant="title3" weight="600">
            Nothing repeating yet
          </Text>
          <Text variant="subheadline" color="secondaryLabel">
            Once a payee turns up in 3 different months, like rent, Netflix, a SIP or an EMI, Gullak pins it here with the
            next date and what it costs you in a year.
          </Text>
          <Text variant="subheadline" color="secondaryLabel">
            Paying rent in cash? Add it each month and it counts too.
          </Text>
          <Button title="Add a Cash Payment" kind="tinted" onPress={() => router.push('/add')} style={{ marginTop: 6 }} />
        </Card>
      )}
    </Screen>
  );
}

function Hero({ total, count, weekTotal, weekCount }: { total: number; count: number; weekTotal: number; weekCount: number }) {
  const c = useColors();
  return (
    <Card tone="clay" style={styles.hero}>
      <View style={styles.heroTop}>
        <Text variant="subheadline" weight="600" style={{ color: c.onTint, opacity: 0.85 }}>
          Repeating every month
        </Text>
        <Coin size={26} />
      </View>
      <Text pixel style={[styles.heroAmount, { color: c.onTint }]} numberOfLines={1} adjustsFontSizeToFit>
        {money(total, { whole: true })}
      </Text>
      <Text variant="footnote" style={{ color: c.onTint, opacity: 0.85 }}>
        {count} payment{count === 1 ? '' : 's'}
        {weekCount ? ` · ${money(weekTotal, { whole: true })} due in the next 7 days` : ' · nothing due this week'}
      </Text>
      <MatkaBand color={c.cream} style={styles.heroBand} />
      <View style={[styles.pill, { backgroundColor: c.cream, borderColor: c.outline }]}>
        <Text variant="footnote" weight="700" style={{ color: '#1C0F0C' }}>
          {money(total * 12, { whole: true })} a year
        </Text>
      </View>
    </Card>
  );
}

function Ticket({ r, first }: { r: Recurring; first: boolean }) {
  const c = useColors();
  const days = daysUntil(r.next);
  const late = days < 0;
  const soon = days >= 0 && days <= 3;
  // The soonest ticket gets a gold stub; the stub is always light, so its ink is fixed.
  const stubColor = first && !late ? c.gold : c.cardElevated;
  const stubInk = first && !late ? '#1C0F0C' : c.label;
  return (
    <View
      accessible
      accessibilityLabel={`${r.name}, ${money(r.amount, { whole: true })}. ${when(days, r.next)}, around ${shortDate(r.next)}. Seen in ${r.months} months.`}>
      <Sticker radius={layout.radius} style={styles.ticket}>
        <View style={[styles.stub, { backgroundColor: stubColor }]}>
          <Text variant="caption1" weight="600" style={{ color: stubInk }}>
            {MONTHS[r.next.getMonth()]}
          </Text>
          <Text pixel style={[styles.stubDay, { color: stubInk }]}>
            {r.next.getDate()}
          </Text>
          <Text variant="caption2" style={{ color: stubInk, opacity: 0.7 }}>
            {WEEKDAYS[r.next.getDay()]}
          </Text>
        </View>
        <View style={styles.perforation} accessible={false}>
          {Array.from({ length: 7 }, (_, i) => (
            <View key={i} style={[styles.hole, { backgroundColor: c.separator }]} />
          ))}
        </View>
        <View style={styles.body}>
          <MerchantTile name={r.name} category={r.category} size={30} />
          <View style={styles.bodyText}>
            <Text variant="headline" numberOfLines={1}>
              {r.name}
            </Text>
            <Text variant="footnote" weight={soon || late ? '600' : '400'} color={late ? 'orange' : soon ? 'tint' : 'secondaryLabel'} numberOfLines={1}>
              {late ? '! ' : ''}
              {when(days, r.next)}
            </Text>
            <Text variant="caption1" color="secondaryLabel" numberOfLines={1}>
              {r.category} · seen {r.months} months
            </Text>
          </View>
          <Text pixel variant="headline" tabular style={styles.amount}>
            {money(r.amount, { whole: true })}
          </Text>
        </View>
      </Sticker>
      {/* Punched notches either side of the perforation. */}
      <View style={[styles.notchClip, styles.notchTop]} pointerEvents="none">
        <View style={[styles.notch, { top: -NOTCH / 2, backgroundColor: c.groupedBackground, borderColor: c.outline }]} />
      </View>
      <View style={[styles.notchClip, styles.notchBottom]} pointerEvents="none">
        <View style={[styles.notch, { top: 0, backgroundColor: c.groupedBackground, borderColor: c.outline }]} />
      </View>
    </View>
  );
}

const STUB = 64;
const NOTCH = 14;

const styles = StyleSheet.create({
  hero: { marginHorizontal: layout.inset, marginBottom: 24, gap: 2 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroAmount: { fontSize: 44, lineHeight: 54, marginTop: 2 },
  heroBand: { marginTop: 12, marginBottom: 12, marginHorizontal: -2 },
  pill: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  header: { paddingHorizontal: layout.inset * 2, paddingBottom: 7 },
  tickets: { paddingHorizontal: layout.inset, gap: 10 },
  ticket: { flexDirection: 'row', alignItems: 'stretch', minHeight: 76 },
  stub: { width: STUB, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  stubDay: { fontSize: 26, lineHeight: 30 },
  perforation: { width: 2, justifyContent: 'space-evenly', alignItems: 'center', paddingVertical: 8 },
  hole: { width: 2, height: 4, borderRadius: 1 },
  body: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  bodyText: { flex: 1, minWidth: 0, gap: 1 },
  amount: { flexShrink: 0 },
  // Each notch is a page-coloured circle, half hidden by a clip box on the ticket's edge: a punched bite.
  notchClip: {
    position: 'absolute',
    // Over the perforation: outline (2) + stub width + half the perforation.
    left: 2 + STUB + 1 - NOTCH / 2,
    width: NOTCH,
    height: NOTCH / 2,
    overflow: 'hidden',
  },
  notch: { position: 'absolute', left: 0, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, borderWidth: 2 },
  notchTop: { top: 0 },
  // The sticker keeps 3px under the face for its shadow.
  notchBottom: { bottom: 3 },
  footer: { paddingHorizontal: layout.inset * 2, paddingTop: 14, paddingBottom: 8 },
  empty: { marginHorizontal: layout.inset, marginTop: 8, gap: 8 },
  emptyCoins: { flexDirection: 'row', gap: 4, marginBottom: 2 },
});
