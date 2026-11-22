import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { categoryMeta } from '@/lib/categories';
import { displayName, signedMoney, time } from '@/lib/format';
import type { Transaction } from '@/lib/types';
import { IconTile, Row } from '@/ui/list';
import { Text } from '@/ui/text';
import { useColors } from '@/ui/theme';

/**
 * The category's emoji on its colour, in an outlined square.
 * `unknown` draws a gold "?" instead: a payee Gullak can't sort yet.
 */
export function CategoryTile({ category, size = 32, unknown }: { category: string; size?: number; unknown?: boolean }) {
  const c = useColors();
  if (unknown) {
    return (
      <IconTile color={c.gold} size={size}>
        <Text pixel style={{ fontSize: size * 0.56, lineHeight: size * 0.72, color: '#1C0F0C' }}>
          ?
        </Text>
      </IconTile>
    );
  }
  const meta = categoryMeta(category);
  return (
    <IconTile color={c[meta.color]} size={size}>
      <Text style={{ fontSize: size * 0.52, lineHeight: size * 0.7 }}>{meta.emoji}</Text>
    </IconTile>
  );
}

export function TxnRow({ t, showTime = true }: { t: Transaction; showTime?: boolean }) {
  const c = useColors();
  const needsCategory = t.category_source === 'unknown';
  const credit = t.direction === 'credit';
  const rest = [showTime ? time(t.occurred_at) : null, t.hidden ? 'Hidden' : null].filter(Boolean).join(' · ');
  const name = displayName(t);
  const subtitle = (
    <Text variant="footnote" color="secondaryLabel" numberOfLines={1}>
      {needsCategory ? (
        <Text variant="footnote" weight="600" color="tint">
          Needs a category
        </Text>
      ) : (
        `${t.category}${t.category_source === 'model' ? ' · auto' : ''}`
      )}
      {rest ? ` · ${rest}` : ''}
    </Text>
  );
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/transaction', params: { id: t.id } })}
      accessibilityRole="button"
      accessibilityLabel={txnLabel(t)}
      accessibilityHint="Opens the payment"
      style={({ pressed }) => pressed && { backgroundColor: c.fill }}>
      <Row
        left={<CategoryTile category={t.category} unknown={needsCategory} />}
        title={
          <Text weight="500" numberOfLines={1}>
            {name}
          </Text>
        }
        subtitle={subtitle}
        value={
          <Text
            tabular
            weight="600"
            color={credit ? 'green' : 'label'}
            numberOfLines={1}
            style={t.hidden ? { opacity: 0.4, textDecorationLine: 'line-through' } : undefined}>
            {signedMoney(t)}
          </Text>
        }
      />
    </Pressable>
  );
}

/** Screen-reader sentence for a payment, e.g. "Zomato, paid ₹679.00, Food, 12:50 pm". */
export function txnLabel(t: Transaction) {
  return [
    displayName(t),
    `${t.direction === 'credit' ? 'received' : 'paid'} ${signedMoney(t).slice(1)}`,
    t.category_source === 'unknown' ? 'needs a category' : t.category,
    time(t.occurred_at),
    t.hidden ? 'hidden' : null,
  ]
    .filter(Boolean)
    .join(', ');
}
