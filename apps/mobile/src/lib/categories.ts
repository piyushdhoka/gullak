import type { GlyphName } from '@/ui/glyphs';
import type { ColorName } from '@/ui/theme';

export const CATEGORIES = [
  'Food',
  'Groceries',
  'Shopping',
  'Transport',
  'Travel',
  'Bills',
  'Entertainment',
  'Health',
  'Investments',
  'Transfers',
  'Cash',
  'Income',
  'Refund',
  'Other',
] as const;

// `emoji` stays for plain-text places (notifications); the UI draws `glyph`.
export const CATEGORY_META: Record<string, { emoji: string; glyph: GlyphName; color: ColorName }> = {
  Food: { emoji: '🍔', glyph: 'food', color: 'orange' },
  Groceries: { emoji: '🛒', glyph: 'groceries', color: 'green' },
  Shopping: { emoji: '🛍️', glyph: 'shopping', color: 'pink' },
  Transport: { emoji: '🚕', glyph: 'transport', color: 'yellow' },
  Travel: { emoji: '✈️', glyph: 'travel', color: 'cyan' },
  Bills: { emoji: '💡', glyph: 'bills', color: 'indigo' },
  Entertainment: { emoji: '🎬', glyph: 'entertainment', color: 'purple' },
  Health: { emoji: '💊', glyph: 'health', color: 'red' },
  Investments: { emoji: '📈', glyph: 'investments', color: 'mint' },
  Transfers: { emoji: '👤', glyph: 'transfers', color: 'blue' },
  Cash: { emoji: '💵', glyph: 'cash', color: 'brown' },
  Income: { emoji: '💰', glyph: 'income', color: 'green' },
  Refund: { emoji: '↩️', glyph: 'refund', color: 'teal' },
  Other: { emoji: '📦', glyph: 'other', color: 'gray' },
};

export function categoryMeta(category: string) {
  return CATEGORY_META[category] ?? CATEGORY_META.Other;
}
