// A Gullak Jar at a glance: icon, name, a line of status, saved / target and a progress bar.

import { Pressable, StyleSheet, View } from 'react-native';

import { money } from '@/lib/format';
import { Card } from '@/ui/controls';
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
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.emoji}>{emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text variant="headline" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="footnote" color={warn ? 'orange' : 'secondaryLabel'} numberOfLines={1}>
              {line}
            </Text>
          </View>
          <Text tabular weight="600">
            {money(saved, { whole: true })}
            <Text variant="footnote" color="secondaryLabel"> / {money(target, { whole: true })}</Text>
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: c.fillTertiary }]}>
          <View style={{ width: `${Math.max(2, progress * 100)}%`, height: '100%', borderRadius: 4, backgroundColor: progress >= 1 ? c.green : c.gold }} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: layout.inset, marginBottom: 12, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 30 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
});
