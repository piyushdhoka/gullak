import { Pressable, StyleSheet, View } from 'react-native';

import { monthName } from '@/lib/format';
import { addMonths, monthOf, sameMonth, type Month } from '@/lib/stats';
import { BackChevron, Chevron } from '@/ui/icons';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

export function MonthSwitcher({ month, onChange, earliest }: { month: Month; onChange: (m: Month) => void; earliest?: Month }) {
  const c = useColors();
  const now = monthOf(new Date());
  const atLatest = sameMonth(month, now);
  const atEarliest = earliest ? sameMonth(month, earliest) : false;
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => onChange(addMonths(month, -1))}
        disabled={atEarliest}
        hitSlop={10}
        accessibilityLabel="Previous month"
        style={({ pressed }) => [styles.arrow, { backgroundColor: c.fillTertiary, opacity: atEarliest ? 0.3 : pressed ? 0.5 : 1 }]}>
        <BackChevron color={c.tint} size={14} />
      </Pressable>
      <Text variant="headline" style={styles.label}>
        {monthName(month, month.year !== now.year)}
      </Text>
      <Pressable
        onPress={() => onChange(addMonths(month, 1))}
        disabled={atLatest}
        hitSlop={10}
        accessibilityLabel="Next month"
        style={({ pressed }) => [styles.arrow, { backgroundColor: c.fillTertiary, opacity: atLatest ? 0.3 : pressed ? 0.5 : 1 }]}>
        <Chevron color={c.tint} size={14} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: layout.inset,
    marginBottom: 16,
  },
  arrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, textAlign: 'center' },
});

/** "2026-10" ⇄ Month, for passing a month in a URL. */
export function monthParam(m: Month) {
  return `${m.year}-${String(m.month + 1).padStart(2, '0')}`;
}

export function parseMonthParam(v: unknown): Month | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  return m ? { year: Number(m[1]), month: Number(m[2]) - 1 } : null;
}
