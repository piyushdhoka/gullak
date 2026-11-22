// Home: bank SMS Gullak couldn't read, shown where you'll see them, with a one-tap way to file them yourself.

import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useData } from '@/lib/data';
import { fullDate } from '@/lib/format';
import { Button } from '@/ui/controls';
import { Glyph } from '@/ui/glyphs';
import { IconTile } from '@/ui/list';
import { Sticker } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

export function UnreadSms() {
  const c = useColors();
  const { inbox } = useData();
  if (!inbox.length) return null;
  const latest = inbox[0];
  const n = inbox.length;
  return (
    <Sticker radius={layout.radius} style={styles.card}>
      <View style={styles.head}>
        <IconTile color={c.orange}>
          <Glyph name="mail" size={18} color="#FFFFFF" />
        </IconTile>
        <View style={{ flex: 1 }}>
          <Text variant="subheadline" weight="700">
            {n === 1 ? '1 bank SMS needs you' : `${n} bank SMS need you`}
          </Text>
          <Text variant="caption1" color="secondaryLabel">
            Gullak couldn’t read {n === 1 ? 'it' : 'them'}. Add {n === 1 ? 'it' : 'each'} yourself and pick a category.
          </Text>
        </View>
      </View>
      <View style={[styles.bubble, { backgroundColor: c.fillTertiary }]}>
        <Text variant="caption1" weight="600" color="secondaryLabel">
          {fullDate(latest.received_at)}
        </Text>
        <Text variant="footnote" numberOfLines={3}>
          {latest.body}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button title="Add as payment" size="small" onPress={() => router.push({ pathname: '/add', params: { sms: latest.id } })} />
        <Button title={n > 1 ? `See all ${n}` : 'See it'} kind="tinted" size="small" onPress={() => router.push('/inbox')} />
      </View>
    </Sticker>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: layout.inset, marginBottom: 16, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bubble: { borderRadius: 12, borderTopLeftRadius: 4, padding: 10, gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
