// One tap per unknown payee: QR codes and IDs can't be categorised from the name,
// so the owner picks once and every past and future payment to that payee follows.

import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CATEGORIES, categoryMeta } from '@/lib/categories';
import { useData } from '@/lib/data';
import { dayLabel, money } from '@/lib/format';
import type { ReviewItem } from '@/lib/types';
import { Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

// Spend categories only; Income/Refund don't apply to outgoing payments.
const CHOICES = CATEGORIES.filter((c) => c !== 'Income' && c !== 'Refund');

export default function ReviewScreen() {
  const { review, resolveReview } = useData();
  return (
    <Screen title="Review" largeTitle={false} back="Summary" tabBar={false}>
      <View style={styles.intro}>
        <Text variant="title3" weight="600">
          Pick once. Gullak remembers.
        </Text>
        <Text variant="subheadline" color="secondaryLabel" style={{ marginTop: 2 }}>
          These payees are just codes, like a shop’s QR, so they can’t be sorted automatically. Pick a category once and
          every past and future payment to that payee follows.
        </Text>
      </View>
      {review.length === 0 ? (
        <View style={styles.done}>
          <Text display variant="title2" align="center">
            All caught up
          </Text>
          <Text color="secondaryLabel" align="center">
            Every payee has a category.
          </Text>
        </View>
      ) : (
        review.map((item) => <ReviewCard key={item.key} item={item} onPick={(cat) => resolveReview(item.key, cat)} />)
      )}
    </Screen>
  );
}

function ReviewCard({ item, onPick }: { item: ReviewItem; onPick: (category: string) => void }) {
  const c = useColors();
  const name = item.merchant ?? item.payee ?? 'Unknown payee';
  return (
    <Section
      header={`${item.count} payment${item.count === 1 ? '' : 's'} · ${money(item.total)} · last ${dayLabel(new Date(item.last_at)).toLowerCase()}`}>
      <View style={styles.body}>
        <Text variant="headline" numberOfLines={1} style={styles.pad}>
          {name}
        </Text>
        {item.vpa && item.vpa !== name ? (
          <Text variant="footnote" color="secondaryLabel" numberOfLines={1} style={styles.pad}>
            {item.vpa}
          </Text>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CHOICES.map((cat) => {
            const meta = categoryMeta(cat);
            return (
              <Pressable
                key={cat}
                onPress={() => onPick(cat)}
                accessibilityRole="button"
                accessibilityLabel={`${name}: ${cat}`}
                style={({ pressed }) => [styles.chip, { backgroundColor: `${c[meta.color]}22`, opacity: pressed ? 0.6 : 1 }]}>
                <Text style={{ fontSize: 15 }}>{meta.emoji}</Text>
                <Text variant="subheadline" weight="600" style={{ color: c[meta.color] }}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: layout.inset + 4, paddingTop: 12, marginBottom: 22 },
  done: { marginTop: 32, gap: 4, paddingHorizontal: layout.inset },
  body: { paddingTop: 12, paddingBottom: 12, gap: 2 },
  pad: { paddingHorizontal: layout.inset },
  chips: { gap: 8, paddingHorizontal: layout.inset, paddingTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 6 },
});
