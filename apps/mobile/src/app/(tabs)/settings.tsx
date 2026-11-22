import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { confirm } from '@/lib/confirm';

import { Wordmark } from '@/components/wordmark';
import { APP_NAME, TAGLINE_EN } from '@/lib/app';
import { useData } from '@/lib/data';
import { IconTile, Row, Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { useColors } from '@/ui/theme';

export default function SettingsScreen() {
  const { mode, session, inbox, transactions, budgets, jars, signOut, deleteAccount } = useData();
  const c = useColors();
  const hidden = transactions.filter((t) => t.hidden).length;
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const removeAccount = async () => {
    const sure = await confirm(
      'Delete your Gullak account?',
      `Everything for ${session?.email ?? 'this account'} is deleted for good: payments, messages, budgets, devices.`,
      'Delete',
    );
    if (!sure) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
    } catch (e) {
      setDeleteError((e as Error).message);
      setDeleting(false);
    }
  };
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

      <Section header="Money">
        <Row
          left={
            <IconTile color={c.green}>
              <Text style={{ fontSize: 16 }}>🎯</Text>
            </IconTile>
          }
          title="Budgets"
          value={budgets.length ? String(budgets.length) : undefined}
          chevron
          onPress={() => router.push('/budgets')}
        />
        <Row
          left={
            <IconTile color={c.purple}>
              <Text style={{ fontSize: 16 }}>🔁</Text>
            </IconTile>
          }
          title="Subscriptions & repeats"
          chevron
          onPress={() => router.push('/subscriptions')}
        />
        <Row
          left={
            <IconTile color={c.gold}>
              <Text style={{ fontSize: 16 }}>🐷</Text>
            </IconTile>
          }
          title="Gullak Jars"
          value={jars.length ? String(jars.length) : undefined}
          chevron
          onPress={() => router.push('/jars')}
        />
        <Row
          left={
            <IconTile color={c.tint}>
              <Text style={{ fontSize: 16 }}>💬</Text>
            </IconTile>
          }
          title="Ask Gullu"
          chevron
          onPress={() => router.push('/ask')}
        />
        <Row
          left={
            <IconTile color={c.brown}>
              <Text style={{ fontSize: 16 }}>💵</Text>
            </IconTile>
          }
          title="Add a cash payment"
          chevron
          onPress={() => router.push('/add')}
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


      <Section header="About" footer={`${APP_NAME} reads the SMS your bank sends (forwarded by an iOS Shortcut on iPhone) and sorts each payment automatically. Personal messages are discarded without being stored.`}>
        <Row title="Version" value="0.1.0" />
        <Row title="Capture" value="Bank SMS" />
      </Section>

      {mode === 'live' ? (
        <>
          <Section>
            <Row title="Sign Out" destructive onPress={signOut} />
          </Section>
          <Section footer={deleteError ?? 'Deletes your account and everything in it: payments, messages, budgets, jars and devices. This can’t be undone.'}>
            <Row title={deleting ? 'Deleting…' : 'Delete Account'} destructive disabled={deleting} onPress={removeAccount} />
          </Section>
        </>
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
