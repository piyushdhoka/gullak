import { Pressable, StyleSheet, View } from 'react-native';

import { monthName } from '@/lib/format';
import { addMonths, monthOf, sameMonth, type Month } from '@/lib/stats';
import { BackChevron, Chevron } from '@/ui/icons';
import { Sticker } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

export function MonthSwitcher({ month, onChange, earliest }: { month: Month; onChange: (m: Month) => void; earliest?: Month }) {
  const now = monthOf(new Date());
  const atLatest = sameMonth(month, now);
  const atEarliest = earliest ? sameMonth(month, earliest) : false;
  const otherYear = month.year !== now.year;
  return (
    <View style={styles.wrap}>
      <Arrow
        dir="back"
        disabled={atEarliest}
        label={`Previous month, ${monthName(addMonths(month, -1), true)}`}
        onPress={() => onChange(addMonths(month, -1))}
      />
      <View style={styles.label} accessibilityRole="header" accessibilityLabel={monthName(month, true)}>
        <Text pixel variant="title3" numberOfLines={1}>
          {monthName(month)}
        </Text>
        {otherYear ? (
          <Text pixel variant="footnote" color="secondaryLabel">
            {month.year}
          </Text>
        ) : null}
      </View>
      <Arrow
        dir="next"
        disabled={atLatest}
        label={`Next month, ${monthName(addMonths(month, 1), true)}`}
        onPress={() => onChange(addMonths(month, 1))}
      />
    </View>
  );
}

// A small outlined key, like the mascot's sticker buttons: it presses down onto its shadow.
function Arrow({ dir, disabled, label, onPress }: { dir: 'back' | 'next'; disabled: boolean; label: string; onPress: () => void }) {
  const c = useColors();
  const Icon = dir === 'back' ? BackChevron : Chevron;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{ opacity: disabled ? 0.35 : 1 }}>
      {({ pressed }) => (
        <Sticker radius={10} lift={2} pressed={pressed} style={styles.arrow}>
          <Icon color={disabled ? c.tertiaryLabel : c.tint} size={14} />
        </Sticker>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: layout.inset,
    marginBottom: 16,
    gap: 8,
  },
  arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, alignItems: 'center' },
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
