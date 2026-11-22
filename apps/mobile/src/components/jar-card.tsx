// A Gullak Jar at a glance: a small pixel pot filling with coins, the jar's name and status,
// saved / target in pixel numerals and a pixel bar. Presses down like a sticker.

import { Pressable, StyleSheet, View } from 'react-native';

import { money } from '@/lib/format';
import { PotMeter } from '@/components/pot-meter';
import { PixelBar, Sticker } from '@/ui/sticker';
import { JarIcon } from '@/ui/glyphs';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

export function JarCard({
  emoji,
  name,
  saved,
  target,
  progress,
  line,
  warn,
  onPress,
}: {
  emoji: string;
  name: string;
  saved: number;
  target: number;
  progress: number;
  line: string;
  warn?: boolean;
  onPress?: () => void;
}) {
  const c = useColors();
  const done = progress >= 1;
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const body = (pressed: boolean) => (
    <Sticker pressed={pressed} style={styles.card}>
      <View style={styles.top}>
        <View>
          <PotMeter progress={progress} size={46} label={null} />
          <View style={[styles.emoji, { backgroundColor: c.cardElevated, borderColor: c.outline }]}>
            <JarIcon emoji={emoji} size={15} color={c.label} />
          </View>
        </View>
        <View style={styles.middle}>
          <Text variant="headline" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="footnote" color={warn ? 'orange' : done ? 'green' : 'secondaryLabel'} numberOfLines={2}>
            {warn ? '! ' : done ? '✓ ' : ''}
            {line}
          </Text>
        </View>
        <View style={styles.amounts}>
          <Text pixel variant="title3" tabular numberOfLines={1}>
            {money(saved, { whole: true })}
          </Text>
          <Text variant="caption1" color="secondaryLabel" numberOfLines={1}>
            of {money(target, { whole: true })}
          </Text>
        </View>
      </View>
      <View style={styles.barRow}>
        <View style={{ flex: 1 }}>
          <PixelBar value={progress} color={done ? c.green : c.gold} height={10} />
        </View>
        <Text pixel variant="footnote" color="secondaryLabel" style={styles.pct}>
          {pct}%
        </Text>
      </View>
    </Sticker>
  );
  if (!onPress) return <View style={styles.wrap}>{body(false)}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}: ${money(saved, { whole: true })} of ${money(target, { whole: true })} saved, ${pct}% full. ${line}`}
      style={styles.wrap}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: layout.inset, marginBottom: 12 },
  card: { borderRadius: layout.cardRadius, padding: 14, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: {
    position: 'absolute',
    right: -6,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 13, lineHeight: 16 },
  middle: { flex: 1, minWidth: 0, gap: 2 },
  amounts: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '42%' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pct: { minWidth: 34, textAlign: 'right' },
});
