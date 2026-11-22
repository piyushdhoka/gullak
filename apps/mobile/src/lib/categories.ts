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

export const CATEGORY_META: Record<string, { emoji: string; color: ColorName }> = {
  Food: { emoji: '🍔', color: 'orange' },
  Groceries: { emoji: '🛒', color: 'green' },
  Shopping: { emoji: '🛍️', color: 'pink' },
  Transport: { emoji: '🚕', color: 'yellow' },
  Travel: { emoji: '✈️', color: 'cyan' },
  Bills: { emoji: '💡', color: 'indigo' },
  Entertainment: { emoji: '🎬', color: 'purple' },
  Health: { emoji: '💊', color: 'red' },
  Investments: { emoji: '📈', color: 'mint' },
  Transfers: { emoji: '👤', color: 'blue' },
  Cash: { emoji: '💵', color: 'brown' },
  Income: { emoji: '💰', color: 'green' },
  Refund: { emoji: '↩️', color: 'teal' },
  Other: { emoji: '📦', color: 'gray' },
};

export function categoryMeta(category: string) {
  return CATEGORY_META[category] ?? CATEGORY_META.Other;
}
