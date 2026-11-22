import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useData } from '@/lib/data';
import { fullDate } from '@/lib/format';
import { copyText } from '@/lib/push';
import { Button } from '@/ui/controls';
import { Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { layout } from '@/ui/theme';

export default function InboxScreen() {
  const { inbox, dismissSms } = useData();
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <Screen title="Not Recognised" largeTitle={false} back="Settings" tabBar={false}>
      <Text variant="subheadline" color="secondaryLabel" style={styles.intro}>
        Bank messages the parser couldn’t turn into a payment. Copy one and share it so its format can be supported.
      </Text>
      {inbox.length === 0 ? (
        <Text color="secondaryLabel" align="center" style={{ marginTop: 32 }}>
          Nothing here. Every bank SMS was understood.
        </Text>
      ) : (
        inbox.map((m) => (
          <Section key={m.id} header={`${fullDate(m.received_at)}${m.reason ? ` · ${m.reason}` : ''}`}>
            <View style={styles.body}>
              <Text variant="subheadline" selectable>
                {m.body}
              </Text>
              <View style={styles.actions}>
                <Button
                  title={copied === m.id ? 'Copied' : 'Copy'}
                  kind="gray"
                  size="small"
                  onPress={async () => {
                    if (await copyText(m.body)) setCopied(m.id);
                  }}
                />
                <Button title="Dismiss" kind="tinted" tint="red" size="small" onPress={() => dismissSms(m.id)} />
              </View>
            </View>
          </Section>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: layout.inset + 4, paddingTop: 12, marginBottom: 20 },
  body: { padding: layout.inset, gap: 12 },
  actions: { flexDirection: 'row', gap: 8 },
});
