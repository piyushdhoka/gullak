import { router } from 'expo-router';

import { categoryMeta } from '@/lib/categories';
import { displayName, signedMoney, time } from '@/lib/format';
import type { Transaction } from '@/lib/types';
import { IconTile, Row } from '@/ui/list';
import { Text } from '@/ui/text';
import { useColors } from '@/ui/theme';

export function CategoryTile({ category, size = 32 }: { category: string; size?: number }) {
  const c = useColors();
  const meta = categoryMeta(category);
  return (
    <IconTile color={c[meta.color]} size={size}>
      <Text style={{ fontSize: size * 0.52, lineHeight: size * 0.7 }}>{meta.emoji}</Text>
    </IconTile>
  );
}

export function TxnRow({ t, showTime = true }: { t: Transaction; showTime?: boolean }) {
  const needsCategory = t.category_source === 'unknown';
  const rest = [showTime ? time(t.occurred_at) : null, t.hidden ? 'Hidden' : null].filter(Boolean).join(' · ');
  const subtitle = (
    <Text variant="subheadline" color="secondaryLabel" numberOfLines={1}>
      {needsCategory ? (
        <Text variant="subheadline" color="orange">
          Needs category
        </Text>
      ) : (
        `${t.category}${t.category_source === 'model' ? ' (auto)' : ''}`
      )}
      {rest ? ` · ${rest}` : ''}
    </Text>
  );
  return (
    <Row
      left={<CategoryTile category={needsCategory ? 'Other' : t.category} />}
      title={displayName(t)}
      subtitle={subtitle}
      value={
        <Text
          tabular
          weight="500"
          color={t.direction === 'credit' ? 'green' : 'label'}
          style={t.hidden ? { opacity: 0.4, textDecorationLine: 'line-through' } : undefined}>
          {signedMoney(t)}
        </Text>
      }
      onPress={() => router.push({ pathname: '/transaction', params: { id: t.id } })}
    />
  );
}
