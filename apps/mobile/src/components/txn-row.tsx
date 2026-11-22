import { router } from 'expo-router';
import { Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { categoryMeta } from '@/lib/categories';
import { displayName, signedMoney, time } from '@/lib/format';
import type { Transaction } from '@/lib/types';
import { BRAND_LOGOS, type BrandLogo } from '@/ui/brand-logos';
import { Glyph } from '@/ui/glyphs';
import { IconTile, Row } from '@/ui/list';
import { Text } from '@/ui/text';
import { useColors } from '@/ui/theme';

/**
 * The category's icon on its colour, in an outlined square.
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
      <Glyph name={meta.glyph} size={Math.round(size * 0.62)} color={tileInk(meta.color)} />
    </IconTile>
  );
}

// Brand logos by lower-cased name, so a hand-typed "swiggy" finds Swiggy too.
const LOGO_BY_NAME = new Map<string, BrandLogo>(Object.entries(BRAND_LOGOS).map(([name, logo]) => [name.toLowerCase(), logo]));

/** Relative luminance of a #RRGGBB colour, 0 (black) … 1 (white). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The merchant's real logo (white, or dark on light brand colours) on its brand colour, when Gullak has one;
 * otherwise the category tile. For tiles that stand for one merchant: payment rows, the receipt, repeats.
 */
export function MerchantTile({
  name,
  category,
  size = 32,
  unknown,
}: {
  name?: string | null;
  category: string;
  size?: number;
  unknown?: boolean;
}) {
  const logo = !unknown && name ? LOGO_BY_NAME.get(name.trim().toLowerCase()) : undefined;
  if (!logo) return <CategoryTile category={category} size={size} unknown={unknown} />;
  const ink = luminance(logo.hex) > 0.45 ? '#1C0F0C' : '#FFFFFF';
  const glyph = Math.round(size * 0.58);
  return (
    <IconTile color={logo.hex} size={size}>
      <Svg width={glyph} height={glyph} viewBox="0 0 24 24" accessibilityLabel={logo.title}>
        <Path d={logo.path} fill={ink} />
      </Svg>
    </IconTile>
  );
}

/** Icon colour on a tile: dark ink on the light tile colours, white on the rest. */
export function tileInk(color: string): string {
  return color === 'yellow' || color === 'gold' || color === 'mint' || color === 'cyan' ? '#1C0F0C' : '#FFFFFF';
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
        left={<MerchantTile name={t.merchant} category={t.category} unknown={needsCategory} />}
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
