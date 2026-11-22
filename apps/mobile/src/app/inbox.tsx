import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ReviewMascot } from '@/components/review-parts';
import { useData } from '@/lib/data';
import { fullDate } from '@/lib/format';
import { copyText } from '@/lib/push';
import { Badge, Button, Card } from '@/ui/controls';
import { Screen } from '@/ui/screen';
import { Sticker } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

export default function InboxScreen() {
  const c = useColors();
  const { inbox, dismissSms } = useData();
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <Screen title="Not recognised" largeTitle={false} back="Settings" tabBar={false}>
      <View style={styles.intro}>
        <Text variant="title3" weight="600">
          {inbox.length ? (
            <>
              <Text pixel variant="title3" color="tint">
                {inbox.length}
              </Text>
              {` message${inbox.length === 1 ? '' : 's'} Gullak couldn’t read`}
            </>
          ) : (
            'Messages Gullak couldn’t read'
          )}
        </Text>
        <Text variant="subheadline" color="secondaryLabel" style={{ marginTop: 4 }}>
          Bank texts that didn’t turn into a payment. Add one yourself and pick its category, or dismiss it.
        </Text>
      </View>

      {inbox.length === 0 ? (
        <Card style={styles.empty}>
          <ReviewMascot size={72} />
          <Text display variant="title3" align="center" style={styles.emptyTitle}>
            Nothing stuck in the pot
          </Text>
          <Text variant="subheadline" color="secondaryLabel" align="center">
            Every bank SMS so far became a payment. If one ever doesn’t, it waits here for you.
          </Text>
        </Card>
      ) : (
        inbox.map((m) => (
          <Sticker key={m.id} radius={layout.radius} style={styles.card}>
            <View style={styles.head}>
              <Text variant="footnote" weight="600" color="secondaryLabel" style={{ flexShrink: 1 }} numberOfLines={1}>
                {fullDate(m.received_at)}
              </Text>
              {m.reason ? <Badge text={m.reason} tint="orange" /> : null}
            </View>
            <View style={[styles.bubble, { backgroundColor: c.fillTertiary }]}>
              <Text variant="subheadline" selectable>
                {m.body}
              </Text>
            </View>
            <View style={styles.actions}>
              <Button
                title="Add as payment"
                size="small"
                onPress={() => router.push({ pathname: '/add', params: { sms: m.id } })}
              />
              <Button
                title={copied === m.id ? 'Copied ✓' : 'Copy'}
                kind="tinted"
                size="small"
                onPress={async () => {
                  if (await copyText(m.body)) setCopied(m.id);
                }}
              />
              <Button title="Dismiss" kind="plain" tint="red" size="small" onPress={() => dismissSms(m.id)} />
            </View>
          </Sticker>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: layout.inset + 4, paddingTop: 12, marginBottom: 20 },
  empty: { marginHorizontal: layout.inset, paddingVertical: 24, gap: 6 },
  emptyTitle: { fontSize: 22, lineHeight: 28, marginTop: 10 },
  card: { marginHorizontal: layout.inset, marginBottom: 16, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bubble: { borderRadius: 12, borderTopLeftRadius: 4, padding: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
