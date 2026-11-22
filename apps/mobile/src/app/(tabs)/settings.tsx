import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/wordmark';
import { APP_NAME, TAGLINE_EN } from '@/lib/app';
import { useData } from '@/lib/data';
import { IconTile, Row, Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { useColors } from '@/ui/theme';

export default function SettingsScreen() {
  const { mode, session, inbox, transactions, signOut } = useData();
  const c = useColors();
  const hidden = transactions.filter((t) => t.hidden).length;
  return (
    <Screen title="Settings">
      <Section header="Account">
        <Row
          left={
            <IconTile color={c.gray}>
              <Text style={{ fontSize: 16 }}>👤</Text>
            </IconTile>
          }
          title={mode === 'live' ? session?.email ?? 'Signed in' : 'Demo mode'}
          subtitle={mode === 'live' ? 'Signed in' : 'Showing sample data'}
        />
      </Section>

      <Section header="Messages" footer="Bank SMS the app couldn’t read yet. They’re kept so nothing is lost.">
        <Row
          left={
            <IconTile color={c.orange}>
              <Text style={{ fontSize: 16 }}>✉️</Text>
            </IconTile>
          }
          title="Not Recognised"
          value={String(inbox.length)}
          chevron
          onPress={() => router.push('/inbox')}
        />
        <Row
          left={
            <IconTile color={c.indigo}>
              <Text style={{ fontSize: 16 }}>🙈</Text>
            </IconTile>
          }
          title="Hidden payments"
          subtitle="Shown in Activity, left out of totals"
          value={String(hidden)}
        />
      </Section>

      <Section header="About" footer={`${APP_NAME} reads bank SMS that an iOS Shortcut forwards to your own private server. Personal messages are discarded without being stored.`}>
        <Row title="Version" value="0.1.0" />
        <Row title="Capture" value="SMS · iOS Shortcut" />
      </Section>

      {mode === 'live' ? (
        <Section>
          <Row title="Sign Out" destructive onPress={signOut} />
        </Section>
      ) : null}

      <View style={styles.signature}>
        <Wordmark size={28} hindi={false} />
        <Text variant="footnote" color="secondaryLabel" align="center">
          {TAGLINE_EN}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  signature: { alignItems: 'center', gap: 2, marginTop: 8, marginBottom: 12, opacity: 0.9 },
});
