// One Gullak Jar: the pot filling up, the plan, a nudge from real spending, and putting money in or taking it out.

import { jarPlan } from '@gullak/core/jars.ts';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { JarBreak, useJarBreak } from '@/components/jar-break';
import { JarStatusChip } from '@/components/jar-status';
import { PotMeter } from '@/components/pot-meter';
import { confirm } from '@/lib/confirm';
import { useData } from '@/lib/data';
import { dayLabel, money, shortDate } from '@/lib/format';
import { Button, Card, Field, SegmentedControl } from '@/ui/controls';
import { IconTile, Row, Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Coin, PixelBar, Sticker } from '@/ui/sticker';
import { JarIcon } from '@/ui/glyphs';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

export default function JarScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { jars, jarEntries, transactions, addToJar, deleteJar } = useData();
  const jar = jars.find((j) => j.id === id);
  const plan = useMemo(() => (jar ? jarPlan(jar, jarEntries, transactions) : null), [jar, jarEntries, transactions]);
  const entries = jarEntries.filter((e) => e.jar_id === id);
  // The jar breaks open once, the first time it is seen full on this device.
  const jarBreak = useJarBreak(jar?.id, plan?.status === 'done');
  const [mode, setMode] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!jar || !plan) {
    return (
      <Screen title="Jar" largeTitle={false} back="Jars" tabBar={false}>
        <View style={styles.missing}>
          <PotMeter progress={0} size={88} label={null} />
          <Text variant="headline" align="center">
            Gullak can’t find this jar
          </Text>
          <Text variant="subheadline" color="secondaryLabel" align="center">
            It may still be loading, or it was deleted on another device.
          </Text>
          <Button title="See All Jars" kind="tinted" onPress={() => router.replace('/jars')} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </View>
      </Screen>
    );
  }

  const value = Number(amount.replace(/[,\s₹]/g, ''));
  const valid = Number.isFinite(value) && value > 0 && value <= 1e8 && (mode === 'in' || value <= plan.saved);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await addToJar(jar.id, (mode === 'in' ? 1 : -1) * Math.round(value * 100) / 100);
      setAmount('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (await confirm(`Delete “${jar.name}”?`, 'The jar and its history are removed. Your payments aren’t affected.', 'Delete')) {
      await deleteJar(jar.id);
      router.back();
    }
  };

  const pct = Math.round(plan.progress * 100);
  const verdict =
    plan.status === 'done'
      ? 'Full! Time to enjoy it.'
      : plan.status === 'no_date'
        ? 'No deadline, so fill it at your own pace.'
        : plan.status === 'overdue'
          ? 'The date has passed. Set a new date by creating a new jar, or keep filling this one.'
          : plan.status === 'behind'
            ? `You’re behind the even pace: ${money(plan.expectedByNow!, { whole: true })} would be in by now.`
            : 'You’re on track. Keep the weekly drops going.';

  // Quick amounts to drop in: this week's share first, then round numbers.
  const quick = [
    ...(plan.perWeek != null ? [{ label: `${money(Math.ceil(plan.perWeek), { whole: true })} this week`, v: Math.ceil(plan.perWeek) }] : []),
    { label: money(500, { whole: true }), v: 500 },
    { label: money(1000, { whole: true }), v: 1000 },
  ];

  return (
    <Screen title={jar.name} largeTitle={false} back="Jars" tabBar={false}>
      <JarBreak open={jarBreak.open} name={jar.name} target={money(jar.target, { whole: true })} onClose={jarBreak.dismiss} />
      {/* The one bold thing: the pot itself. */}
      <View style={styles.hero}>
        <PotMeter
          progress={plan.progress}
          done={plan.status === 'done'}
          size={176}
          ground
          label={`${jar.name} jar, ${pct}% full`}
        />
        <View style={styles.heroName}>
          <JarIcon emoji={jar.emoji} size={24} color={c.label} />
          <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
            {jar.name}
          </Text>
        </View>
        <Text pixel style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>
          {money(plan.saved, { whole: true })}
        </Text>
        <Text variant="subheadline" color="secondaryLabel">
          of <Text pixel variant="subheadline">{money(jar.target, { whole: true })}</Text>
          {jar.target_date ? ` · by ${shortDate(new Date(jar.target_date))}` : ''}
        </Text>
        <View style={styles.heroBar}>
          <View style={{ flex: 1 }}>
            <PixelBar value={plan.progress} color={plan.status === 'done' ? c.green : c.gold} height={12} blocks={24} />
          </View>
          <Text pixel variant="subheadline" style={styles.heroPct}>
            {pct}%
          </Text>
        </View>
      </View>

      {plan.status !== 'done' ? (
        <>
          <View style={styles.planHead}>
            <Text variant="footnote" weight="600" color="secondaryLabel" accessibilityRole="header">
              Plan
            </Text>
            <JarStatusChip plan={plan} />
          </View>
          <Sticker style={styles.grid} radius={layout.radius}>
            <View style={styles.gridRow}>
              <Stat label="Each week" value={plan.perWeek != null ? money(plan.perWeek, { whole: true }) : '—'} hint={plan.perMonth != null ? `${money(plan.perMonth, { whole: true })} a month` : 'no deadline'} tint />
              <View style={[styles.vLine, { backgroundColor: c.separator }]} />
              <Stat
                label="Left to save"
                value={money(plan.left, { whole: true })}
                hint={plan.daysLeft != null && plan.status !== 'overdue' ? `in ${plan.daysLeft} day${plan.daysLeft === 1 ? '' : 's'}` : plan.status === 'overdue' ? 'date has passed' : 'whenever you like'}
              />
            </View>
            <View style={[styles.hLine, { backgroundColor: c.separator }]} />
            <Text variant="subheadline" style={styles.verdict}>
              {verdict}
            </Text>
          </Sticker>
        </>
      ) : (
        <Card style={styles.doneCard}>
          <Text variant="headline">Full! Time to enjoy it.</Text>
          <Text variant="subheadline" color="secondaryLabel">
            Every coin is in. The sprout says you earned this one.
          </Text>
        </Card>
      )}

      {plan.nudge ? (
        <Sticker style={styles.nudge} radius={layout.radius}>
          <View style={styles.nudgeHead}>
            <Coin size={20} />
            <Text variant="footnote" weight="600" color="secondaryLabel">
              A nudge from Gullak
            </Text>
          </View>
          <Text variant="subheadline">{plan.nudge.text}</Text>
        </Sticker>
      ) : null}

      <Section header="Drop money in" footer={error ?? 'Moved money into savings? Add it here. Gullak can’t see transfers to your own savings automatically yet.'}>
        <View style={styles.pad}>
          <SegmentedControl
            options={[
              { value: 'in', label: 'Put in' },
              { value: 'out', label: 'Take out' },
            ]}
            value={mode}
            onChange={setMode}
          />
        </View>
        <Field label="Amount ₹" value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.,]/g, ''))} keyboardType="decimal-pad" placeholder="0" />
        <View style={styles.pad}>
          {mode === 'in' ? (
            <View style={styles.quick}>
              {quick.map((q) => (
                <Pressable
                  key={q.label}
                  onPress={() => setAmount(String(q.v))}
                  accessibilityRole="button"
                  accessibilityLabel={`Fill in ${q.label}`}
                  style={({ pressed }) => [styles.quickChip, { backgroundColor: pressed ? c.fill : c.fillTertiary }]}>
                  <Text variant="footnote" weight="600">
                    {q.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Button title={mode === 'in' ? 'Add to Jar' : 'Take Out'} onPress={save} loading={busy} disabled={!valid} />
        </View>
      </Section>

      {entries.length ? (
        <Section header="History">
          {entries.slice(0, 30).map((e) => {
            const put = e.amount > 0;
            return (
              <Row
                key={e.id}
                left={
                  <IconTile color={put ? c.gold : c.fillTertiary}>
                    <Text variant="footnote" weight="700" style={{ color: put ? '#1C0F0C' : c.label }}>
                      {put ? '↓' : '↑'}
                    </Text>
                  </IconTile>
                }
                title={put ? 'Put in' : 'Taken out'}
                subtitle={dayLabel(new Date(e.created_at))}
                value={
                  <Text pixel tabular color={put ? 'green' : 'label'}>
                    {put ? '+' : '−'}
                    {money(Math.abs(e.amount), { whole: true })}
                  </Text>
                }
              />
            );
          })}
        </Section>
      ) : (
        <Text variant="subheadline" color="secondaryLabel" align="center" style={styles.noHistory}>
          No coins in yet. Drop in the first one above and watch the pot fill.
        </Text>
      )}

      <Section>
        <Row title="Delete Jar" destructive onPress={remove} />
      </Section>
    </Screen>
  );
}

function Stat({ label, value, hint, tint }: { label: string; value: string; hint: string; tint?: boolean }) {
  return (
    <View style={styles.cell}>
      <Text variant="footnote" color="secondaryLabel">
        {label}
      </Text>
      <Text pixel variant="title2" color={tint ? 'tint' : 'label'} numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 2 }}>
        {value}
      </Text>
      <Text variant="caption1" color="secondaryLabel" numberOfLines={1}>
        {hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  missing: { alignItems: 'center', gap: 8, paddingHorizontal: layout.inset * 2, paddingTop: 40 },
  hero: { alignItems: 'center', paddingHorizontal: layout.inset, paddingTop: 8, marginBottom: 28 },
  heroName: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, maxWidth: '100%' },
  heroEmoji: { fontSize: 20, lineHeight: 26 },
  heroAmount: { fontSize: 48, lineHeight: 58, marginTop: 2 },
  heroBar: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', marginTop: 14, maxWidth: 420, width: '100%', marginHorizontal: 'auto' },
  heroPct: { minWidth: 44, textAlign: 'right' },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: layout.inset * 2, paddingBottom: 7 },
  grid: { marginHorizontal: layout.inset, marginBottom: 24 },
  gridRow: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0, paddingHorizontal: 14, paddingVertical: 12 },
  vLine: { width: StyleSheet.hairlineWidth },
  hLine: { height: StyleSheet.hairlineWidth },
  verdict: { paddingHorizontal: 14, paddingVertical: 12 },
  doneCard: { marginHorizontal: layout.inset, marginBottom: 24, gap: 4 },
  nudge: { marginHorizontal: layout.inset, marginBottom: 32, padding: 14, gap: 6 },
  nudgeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pad: { padding: layout.inset, gap: 12 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, justifyContent: 'center' },
  noHistory: { paddingHorizontal: layout.inset * 2, marginBottom: 28 },
});
