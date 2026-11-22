// Activity's controls: an outlined search field, a row of category chips, a day header with the
// day's totals in pixel numerals, and Gullak's empty states.

import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { categoryMeta } from '@/lib/categories';
import { Button, Card } from '@/ui/controls';
import { Glyph, type GlyphName } from '@/ui/glyphs';
import { Text } from '@/ui/text';
import { fontFamily, layout, type, useColors } from '@/ui/theme';

function SearchGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Circle cx={7.5} cy={7.5} r={5.5} stroke={color} strokeWidth={2} fill="none" />
      <Path d="m11.6 11.6 4.4 4.4" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search payee, category, amount',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.search,
        { backgroundColor: c.cardElevated, borderColor: focused ? c.tint : c.outline },
      ]}>
      <SearchGlyph color={focused ? c.tint : c.secondaryLabel} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.tertiaryLabel}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel="Search payments"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[type.callout, styles.searchInput, { color: c.label, fontFamily }, { outlineStyle: 'none' as never }]}
      />
      {value ? (
        <Pressable
          onPress={() => onChange('')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={({ pressed }) => [styles.clear, { backgroundColor: c.fill, opacity: pressed ? 0.5 : 1 }]}>
          <Text variant="caption1" weight="700" color="secondaryLabel">
            ✕
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Horizontal category filter. `null` is "All". The selected chip is painted clay. */
export function CategoryChips({
  categories,
  value,
  onChange,
}: {
  categories: { category: string; count: number }[];
  value: string | null;
  onChange: (category: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      style={styles.chipsWrap}
      accessibilityRole="radiogroup"
      accessibilityLabel="Filter by category">
      <Chip label="All" selected={value == null} onPress={() => onChange(null)} />
      {categories.map(({ category, count }) => (
        <Chip
          key={category}
          label={category}
          glyph={categoryMeta(category).glyph}
          count={count}
          selected={value === category}
          onPress={() => onChange(value === category ? null : category)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({
  label,
  glyph,
  count,
  selected,
  onPress,
}: {
  label: string;
  glyph?: GlyphName;
  count?: number;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const fg = selected ? c.onTint : c.label;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={count != null ? `${label}, ${count} payment${count === 1 ? '' : 's'}` : `${label} categories`}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c.tint : c.card,
          borderColor: c.outline,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      {glyph ? <Glyph name={glyph} size={16} color={fg} /> : null}
      <Text variant="subheadline" weight="600" style={{ color: fg }}>
        {label}
      </Text>
      {count != null ? (
        <Text pixel variant="footnote" style={{ color: fg, opacity: selected ? 0.85 : 0.5 }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** A day's label, with what went out (and came in) that day in pixel numerals. */
export function DayHeader({ label, spent, received }: { label: string; spent: string | null; received: string | null }) {
  const sum = [spent ? `${spent} spent` : null, received ? `${received} received` : null].filter(Boolean).join(', ');
  return (
    <View style={styles.day} accessibilityRole="header" accessibilityLabel={sum ? `${label}, ${sum}` : label}>
      <Text variant="footnote" weight="600" color="secondaryLabel" style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      {received ? (
        <Text pixel variant="subheadline" color="green">
          +{received}
        </Text>
      ) : null}
      {spent ? (
        <Text pixel variant="subheadline" color="label">
          −{spent}
        </Text>
      ) : null}
    </View>
  );
}

/** Gullak's voice for an empty list: a title, one warm line, one next step. */
export function ActivityEmpty({
  title,
  body,
  action,
  onAction,
  primary,
}: {
  title: string;
  body: ReactNode;
  action: string;
  onAction: () => void;
  primary?: boolean;
}) {
  return (
    <Card style={styles.empty}>
      <Text display variant="title3" style={styles.emptyTitle}>
        {title}
      </Text>
      <Text variant="subheadline" color="secondaryLabel" style={{ marginTop: 4, marginBottom: 14 }}>
        {body}
      </Text>
      {primary ? (
        <Button title={action} onPress={onAction} />
      ) : (
        <Button title={action} kind="tinted" size="small" onPress={onAction} style={{ alignSelf: 'flex-start' }} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: layout.inset,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: layout.outline,
    paddingLeft: 12,
    paddingRight: 8,
    minHeight: 46,
  },
  searchInput: { flex: 1, paddingVertical: 10, minWidth: 0 },
  clear: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chipsWrap: { flexGrow: 0, marginBottom: 12 },
  chips: { gap: 8, paddingHorizontal: layout.inset, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    paddingHorizontal: 13,
  },
  chipEmoji: { fontSize: 15, lineHeight: 20 },
  day: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingHorizontal: layout.inset + layout.inset,
    paddingBottom: 7,
  },
  empty: { marginHorizontal: layout.inset, marginTop: 8, marginBottom: 20 },
  emptyTitle: { fontSize: 22, lineHeight: 28 },
});
