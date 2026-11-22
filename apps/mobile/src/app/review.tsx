// One tap per unknown payee: QR codes and IDs can't be categorised from the name,
// so the owner picks once and every past and future payment to that payee follows.
// Played like a quick game: one payee card at a time, a grid of big tiles, a pixel progress bar.

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryTile } from '@/components/txn-row';
import { ReviewCheer, ReviewMascot } from '@/components/review-parts';
import { CATEGORIES } from '@/lib/categories';
import { useData } from '@/lib/data';
import { dayLabel, money } from '@/lib/format';
import type { ReviewItem } from '@/lib/types';
import { Button, Card } from '@/ui/controls';
import { Screen } from '@/ui/screen';
import { Coin, MatkaBand, PixelBar, Sticker } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

// Spend categories only; Income/Refund don't apply to outgoing payments.
const CHOICES = CATEGORIES.filter((c) => c !== 'Income' && c !== 'Refund');
const ROWS = Array.from({ length: Math.ceil(CHOICES.length / 3) }, (_, i) => CHOICES.slice(i * 3, i * 3 + 3));

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function ReviewScreen() {
  const c = useColors();
  const { review, resolveReview, loading } = useData();
  const [sorted, setSorted] = useState(0);
  const [skip, setSkip] = useState(0);
  const [last, setLast] = useState<{ name: string; category: string } | null>(null);

  const total = sorted + review.length;
  const item = review.length ? review[skip % review.length] : null;

  const pick = (it: ReviewItem, category: string) => {
    setLast({ name: payeeName(it), category });
    setSorted((n) => n + 1);
    resolveReview(it.key, category);
  };

  return (
    <Screen title="Sort new payees" largeTitle={false} back="Summary" tabBar={false}>
      {item ? (
        <>
          <View style={styles.progress}>
            <View style={styles.progressTop}>
              <Text variant="footnote" weight="600" color="secondaryLabel">
                Pick once, Gullak remembers
              </Text>
              <Text variant="footnote" color="secondaryLabel" accessibilityLabel={`${sorted} of ${total} sorted`}>
                <Text pixel variant="subheadline" color="label">
                  {sorted}
                </Text>
                {' of '}
                <Text pixel variant="subheadline" color="label">
                  {total}
                </Text>
              </Text>
            </View>
            <PixelBar value={total ? sorted / total : 0} color={c.green} blocks={Math.min(Math.max(total, 1), 20)} height={10} />
          </View>

          {last ? (
            <Text variant="footnote" weight="600" color="green" style={styles.last} numberOfLines={1} accessibilityLiveRegion="polite">
              ✓ {last.name} is {last.category} now, and always will be.
            </Text>
          ) : null}

          <PayeeCard item={item} />

          <Text variant="headline" style={styles.ask} accessibilityRole="header">
            What was this for?
          </Text>
          <View style={styles.grid}>
            {ROWS.map((row, i) => (
              <View key={i} style={styles.gridRow}>
                {row.map((cat) => (
                  <Tile key={cat} category={cat} name={payeeName(item)} onPress={() => pick(item, cat)} />
                ))}
              </View>
            ))}
          </View>

          {review.length > 1 ? (
            <Button title="Not sure, show me the next one" kind="plain" onPress={() => setSkip((n) => n + 1)} style={styles.skip} />
          ) : null}
          <Text variant="footnote" color="secondaryLabel" style={styles.foot}>
            Payees like a shop’s QR are just codes, so they can’t be sorted automatically. Your pick applies to every past
            and future payment to this payee.
          </Text>
        </>
      ) : loading ? null : sorted > 0 ? (
        <ReviewCheer
          title="All sorted!"
          body={`You sorted ${sorted} payee${sorted === 1 ? '' : 's'}. From now on their payments sort themselves.`}
          bar={<PixelBar value={1} color={c.green} blocks={Math.min(Math.max(sorted, 1), 20)} height={10} />}
          action={<Button title="Back to Summary" onPress={back} />}
        />
      ) : (
        <ReviewCheer
          title="Nothing to sort"
          body="Every payee has a category. When a new QR code or UPI ID turns up, it waits here for one tap."
          action={<Button title="Back to Summary" kind="tinted" onPress={back} />}
          mascot={<ReviewMascot size={88} />}
        />
      )}
    </Screen>
  );
}

/** "today", "yesterday", "Thursday", "Sat, 8 Nov". */
function lastPaid(iso: string) {
  const label = dayLabel(new Date(iso));
  return label === 'Today' || label === 'Yesterday' ? label.toLowerCase() : label;
}

function payeeName(item: ReviewItem) {
  return item.merchant ?? item.payee ?? 'Unknown payee';
}

// The payee, painted on clay: the one bold thing on this screen.
function PayeeCard({ item }: { item: ReviewItem }) {
  const c = useColors();
  const name = payeeName(item);
  return (
    <Card tone="clay" style={styles.card}>
      <View style={styles.cardTop}>
        <Text variant="footnote" weight="600" style={{ color: c.onTint, opacity: 0.85 }}>
          New payee
        </Text>
        <Coin size={24} />
      </View>
      <Text pixel style={[styles.name, { color: c.onTint }]} numberOfLines={2} accessibilityRole="header">
        {name}
      </Text>
      {item.vpa && item.vpa !== name ? (
        <Text variant="footnote" style={{ color: c.onTint, opacity: 0.8 }} numberOfLines={1}>
          {item.vpa}
        </Text>
      ) : null}
      <MatkaBand color={c.cream} style={styles.band} />
      <View style={styles.cardFoot}>
        <Text pixel style={[styles.amount, { color: c.onTint }]} numberOfLines={1}>
          {money(item.total, { whole: item.total >= 1000 })}
        </Text>
        <View style={[styles.pill, { backgroundColor: c.cream, borderColor: c.outline }]}>
          <Text variant="footnote" weight="700" style={{ color: '#1C0F0C' }}>
            {item.count} payment{item.count === 1 ? '' : 's'}
          </Text>
        </View>
      </View>
      <Text variant="footnote" style={{ color: c.onTint, opacity: 0.85 }}>
        Last paid {lastPaid(item.last_at)}
      </Text>
    </Card>
  );
}

function Tile({ category, name, onPress }: { category: string; name: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${category}`}
      accessibilityHint={`Files ${name} under ${category}, now and from now on`}
      style={styles.tileWrap}>
      {({ pressed }) => (
        <Sticker radius={14} pressed={pressed} style={styles.tile}>
          <CategoryTile category={category} size={40} />
          <Text variant="footnote" weight="600" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {category}
          </Text>
        </Sticker>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  progress: { marginHorizontal: layout.inset, marginTop: 8, marginBottom: 14, gap: 8 },
  progressTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  last: { marginHorizontal: layout.inset, marginBottom: 10 },
  card: { marginHorizontal: layout.inset, marginBottom: 22, paddingTop: 14, gap: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  name: { fontSize: 30, lineHeight: 36 },
  band: { marginTop: 8, marginBottom: 10, opacity: 0.9 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  amount: { fontSize: 34, lineHeight: 40, flexShrink: 1 },
  pill: { borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 8, paddingVertical: 3 },
  ask: { marginHorizontal: layout.inset + 4, marginBottom: 10 },
  grid: { marginHorizontal: layout.inset, gap: 8 },
  gridRow: { flexDirection: 'row', gap: 8 },
  tileWrap: { flex: 1, minWidth: 0 },
  tile: { alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 6 },
  skip: { marginHorizontal: layout.inset, marginTop: 14 },
  foot: { marginHorizontal: layout.inset + 4, marginTop: 10, marginBottom: 12 },
});
