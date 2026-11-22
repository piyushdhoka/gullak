// A jar's state as a word, a symbol and a colour, so it never relies on colour alone.

import type { JarPlan } from '@gullak/core/jars.ts';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/ui/text';
import { useColors, type ColorName } from '@/ui/theme';

export function jarStatus(plan: Pick<JarPlan, 'status'>): { word: string; symbol: string; color: ColorName } {
  switch (plan.status) {
    case 'done':
      return { word: 'Full', symbol: '✓', color: 'green' };
    case 'on_track':
      return { word: 'On track', symbol: '✓', color: 'green' };
    case 'behind':
      return { word: 'Behind', symbol: '!', color: 'orange' };
    case 'overdue':
      return { word: 'Past its date', symbol: '!', color: 'red' };
    default:
      return { word: 'No date', symbol: '∞', color: 'secondaryLabel' };
  }
}

/** A small outlined pill: coloured symbol, word in the label colour (readable on any face). */
export function JarStatusChip({ plan }: { plan: Pick<JarPlan, 'status'> }) {
  const c = useColors();
  const s = jarStatus(plan);
  return (
    <View style={[styles.chip, { borderColor: c.outline, backgroundColor: c.cardElevated }]}>
      <Text variant="caption1" weight="700" color={s.color}>
        {s.symbol}
      </Text>
      <Text variant="caption1" weight="600" numberOfLines={1}>
        {s.word}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
});
