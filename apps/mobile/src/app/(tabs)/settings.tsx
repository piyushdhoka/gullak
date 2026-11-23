import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { confirm } from '@/lib/confirm';

import { AppearancePicker } from '@/components/settings-appearance';
import { PushToggle } from '@/components/settings-push';
import { tileInk } from '@/components/txn-row';
import { Wordmark } from '@/components/wordmark';
import { APP_NAME, MAKER, TAGLINE_EN } from '@/lib/app';
import { useData } from '@/lib/data';
import { shortMonth } from '@/lib/format';
import { monthOf } from '@/lib/stats';
import { Glyph, type GlyphName } from '@/ui/glyphs';
import { IconTile, Row, Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Sticker } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { layout, useColors, type ColorName } from '@/ui/theme';

// From app.json, so the number shown always matches the build.
const APP_VERSION = Constants.expoConfig?.version ?? '1.1.0';

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

  const tile = (color: ColorName, glyph: GlyphName) => (
    <IconTile color={c[color]}>
      <Glyph name={glyph} size={18} color={tileInk(color)} />
    </IconTile>
  );

  return (
    <Screen title="Settings">
      <Profile />

      <Section header="Notifications">
        <PushToggle />
      </Section>

      <Section header="Appearance" footer="System follows your phone’s light or dark setting.">
        <AppearancePicker />
      </Section>

      <Section header="Money">
        <Row
          left={tile('green', 'target')}
          title="Budgets"
          value={budgets.length ? String(budgets.length) : undefined}
          chevron
          onPress={() => router.push('/budgets')}
        />
        <Row
          left={tile('purple', 'repeat')}
          title="Subscriptions & repeats"
          chevron
          onPress={() => router.push('/subscriptions')}
        />
        <Row
          left={tile('gold', 'jar')}
          title="Gullak Jars"
          value={jars.length ? String(jars.length) : undefined}
          chevron
          onPress={() => router.push('/jars')}
        />
        <Row left={tile('brown', 'cash')} title="Add a cash payment" chevron onPress={() => router.push('/add')} />
      </Section>

      <Section header="Messages" footer="Bank SMS the app couldn’t read yet. They’re kept so nothing is lost.">
        <Row
          left={tile('orange', 'mail')}
          title="Not recognised"
          value={String(inbox.length)}
          chevron
          onPress={() => router.push('/inbox')}
        />
        <Row
          left={tile('indigo', 'eyeOff')}
          title="Hidden payments"
          subtitle="Shown in Activity, left out of totals"
          value={String(hidden)}
        />
      </Section>

      <Section
        header="About"
        footer={`${APP_NAME} reads the SMS your bank sends (forwarded by an iOS Shortcut on iPhone) and sorts each payment automatically. Personal messages are discarded without being stored.`}>
        <Row title="Version" value={APP_VERSION} />
        <Row title="Capture" value="Bank SMS" />
        <Row title="Made by" value={MAKER.name} onPress={() => Linking.openURL(MAKER.url)} />
      </Section>

      {mode === 'live' ? (
        <>
          <Section header="Account">
            <Row title="Sign Out" destructive onPress={signOut} />
          </Section>
          <Section
            footer={
              deleteError ??
              'Deletes your account and everything in it: payments, messages, budgets, jars and devices. This can’t be undone.'
            }>
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

/** Who's signed in, with the mascot as the avatar and two numbers about what Gullak has done for them. */
function Profile() {
  const { mode, session, transactions } = useData();
  const c = useColors();
  const stats = useMemo(() => {
    const captured = transactions.filter((t) => t.source === 'sms');
    const auto = captured.filter((t) => t.category_source !== 'user' && t.category_source !== 'unknown').length;
    const first = captured.reduce<string | null>((min, t) => (min == null || t.occurred_at < min ? t.occurred_at : min), null);
    return {
      count: captured.length,
      sortedPct: captured.length ? Math.round((auto / captured.length) * 100) : null,
      since: first ? `${shortMonth(monthOf(new Date(first)))} ${new Date(first).getFullYear()}` : null,
    };
  }, [transactions]);

  const live = mode === 'live';
  const name = live ? session?.email ?? 'Signed in' : 'Demo mode';
  const line = { backgroundColor: c.separator };

  return (
    <Sticker style={styles.profile} radius={layout.cardRadius}>
      <View style={styles.who}>
        <View style={[styles.avatar, { backgroundColor: c.cream, borderColor: c.outline }]}>
          <Image
            source={require('../../../assets/images/logo-192.png')}
            style={styles.mascot}
            contentFit="contain"
            accessibilityLabel="Gullak mascot"
          />
        </View>
        <View style={styles.whoText}>
          <Text variant="headline" numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.statusLine}>
            <View style={[styles.dot, { backgroundColor: live ? c.green : c.gold, borderColor: c.outline }]} />
            <Text variant="footnote" color="secondaryLabel" numberOfLines={1} style={styles.flexShrink}>
              {live ? 'Signed in · syncing' : 'Showing sample data'}
            </Text>
          </View>
        </View>
      </View>
      <View style={[styles.hLine, line]} />
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text variant="footnote" color="secondaryLabel">
            Payments captured
          </Text>
          <Text pixel variant="title2" style={styles.statValue} numberOfLines={1}>
            {stats.count.toLocaleString('en-IN')}
          </Text>
          <Text variant="caption1" color="secondaryLabel" numberOfLines={1}>
            {stats.since ? `bank SMS since ${stats.since}` : 'from bank SMS'}
          </Text>
        </View>
        <View style={[styles.vLine, line]} />
        <View style={styles.stat}>
          <Text variant="footnote" color="secondaryLabel">
            Sorted by Gullak
          </Text>
          <Text pixel variant="title2" color="green" style={styles.statValue} numberOfLines={1}>
            {stats.sortedPct != null ? `${stats.sortedPct}%` : '—'}
          </Text>
          <Text variant="caption1" color="secondaryLabel" numberOfLines={1}>
            no taps needed
          </Text>
        </View>
      </View>
    </Sticker>
  );
}

const styles = StyleSheet.create({
  emoji: { fontSize: 16 },
  profile: { marginHorizontal: layout.inset, marginBottom: 35 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 16,
    borderWidth: layout.outline,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mascot: { width: 54, height: 54 },
  whoText: { flex: 1, minWidth: 0, gap: 3 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 2, borderWidth: 1 },
  flexShrink: { flexShrink: 1 },
  hLine: { height: StyleSheet.hairlineWidth },
  vLine: { width: StyleSheet.hairlineWidth },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, minWidth: 0, paddingHorizontal: 16, paddingVertical: 12 },
  statValue: { marginTop: 2 },
  signature: { alignItems: 'center', gap: 2, marginTop: 8, marginBottom: 12, opacity: 0.9 },
});
