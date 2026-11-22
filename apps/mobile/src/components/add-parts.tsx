// Pieces of the Add payment sheet: a calculator keypad, a category tile grid and pill choices.

import { useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CategoryTile } from '@/components/txn-row';
import { Sticker } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

export type AmountKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'del' | 'clear';

const MAX_RUPEE_DIGITS = 8;

/** Apply one keypad press to the typed amount ("1250.5"), like a calculator display. */
export function typeAmount(prev: string, key: AmountKey): string {
  if (key === 'clear') return '';
  if (key === 'del') return prev.slice(0, -1);
  if (key === '.') return prev.includes('.') ? prev : `${prev || '0'}.`;
  const [whole, paise] = prev.split('.');
  if (paise !== undefined) return paise.length >= 2 ? prev : prev + key;
  if (whole === '0') return key;
  if (whole.length >= MAX_RUPEE_DIGITS) return prev;
  return prev + key;
}

/** "1250.5" → "1,250.5" (Indian grouping, the paise kept exactly as typed). */
export function groupAmount(raw: string): string {
  if (!raw) return '0';
  const [whole, paise] = raw.split('.');
  const grouped = new Intl.NumberFormat('en-IN').format(Number(whole || '0'));
  return paise !== undefined ? `${grouped}.${paise}` : grouped;
}

const KEYS: AmountKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'del'],
];

function DeleteGlyph({ color }: { color: string }) {
  return (
    <Svg width={28} height={20} viewBox="0 0 28 20">
      <Path d="M9 2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9l-7-8z" stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
      <Path d="m13 6.5 7 7m0-7-7 7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

/** Big tactile number keys. On the web the physical keyboard works too (outside text fields). */
export function Keypad({ onKey }: { onKey: (key: AmountKey) => void }) {
  const c = useColors();
  const onKeyRef = useRef(onKey);
  useEffect(() => {
    onKeyRef.current = onKey;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) onKeyRef.current(e.key as AmountKey);
      else if (e.key === '.' || e.key === ',') onKeyRef.current('.');
      else if (e.key === 'Backspace') onKeyRef.current('del');
      else if (e.key === 'Escape' || e.key === 'Delete') onKeyRef.current('clear');
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <View style={styles.pad}>
      {KEYS.map((row, i) => (
        <View key={i} style={styles.padRow}>
          {row.map((k) => (
            <Pressable
              key={k}
              onPress={() => onKey(k)}
              onLongPress={k === 'del' ? () => onKey('clear') : undefined}
              accessibilityRole="button"
              accessibilityLabel={k === 'del' ? 'Delete' : k === '.' ? 'Decimal point' : k}
              accessibilityHint={k === 'del' ? 'Long press to clear the amount' : undefined}
              style={styles.keyWrap}>
              {({ pressed }) => (
                <Sticker radius={12} pressed={pressed} color={k === 'del' ? c.cream : c.cardElevated} style={styles.key}>
                  {k === 'del' ? (
                    // Cream is the same in both themes, so the glyph keeps the fixed ink colour.
                    <DeleteGlyph color="#1C0F0C" />
                  ) : (
                    <Text pixel style={styles.keyText}>
                      {k}
                    </Text>
                  )}
                </Sticker>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

/** A grid of big category tiles, three to a row. The picked one is painted clay. */
export function CategoryGrid({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (category: string) => void;
}) {
  const c = useColors();
  const rows = Array.from({ length: Math.ceil(options.length / 3) }, (_, i) => options.slice(i * 3, i * 3 + 3));
  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Category">
      {rows.map((row, i) => (
        <View key={i} style={styles.gridRow}>
          {row.map((cat) => {
            const on = cat === value;
            return (
              <Pressable
                key={cat}
                onPress={() => onChange(cat)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={cat}
                style={styles.tileWrap}>
                {({ pressed }) => (
                  <Sticker radius={14} pressed={pressed || on} color={on ? c.tint : c.card} style={styles.tile}>
                    <CategoryTile category={cat} size={32} />
                    <Text variant="caption1" weight="600" numberOfLines={1} style={{ color: on ? c.onTint : c.label }}>
                      {cat}
                    </Text>
                  </Sticker>
                )}
              </Pressable>
            );
          })}
          {/* Keep the last row's tiles the same width as the rest. */}
          {Array.from({ length: 3 - row.length }, (_, j) => (
            <View key={`gap${j}`} style={styles.tileWrap} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** A horizontal row of pill choices (the day picker). */
export function PillChoices<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const c = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={styles.pills}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: on ? c.tint : c.card, borderColor: c.outline, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Text variant="subheadline" weight="600" style={{ color: on ? c.onTint : c.label }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { marginHorizontal: layout.inset, gap: 8, marginBottom: 24 },
  padRow: { flexDirection: 'row', gap: 8 },
  keyWrap: { flex: 1, minWidth: 0 },
  key: { height: 54, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 26, lineHeight: 32 },
  grid: { marginHorizontal: layout.inset, gap: 8, marginBottom: 24 },
  gridRow: { flexDirection: 'row', gap: 8 },
  tileWrap: { flex: 1, minWidth: 0 },
  tile: { alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 4 },
  pills: { gap: 8, paddingHorizontal: layout.inset, paddingVertical: 2 },
  pill: { minHeight: 38, borderRadius: 19, borderWidth: 1.5, paddingHorizontal: 14, justifyContent: 'center' },
});
