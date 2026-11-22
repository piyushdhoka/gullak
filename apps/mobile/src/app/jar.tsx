// One Gullak Jar: progress, the plan, a nudge from real spending, and putting money in or taking it out.

import { jarPlan } from '@gullak/core/jars.ts';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { JarCard } from '@/components/jar-card';
import { confirm } from '@/lib/confirm';
import { useData } from '@/lib/data';
import { dayLabel, money, shortDate } from '@/lib/format';
import { Button, Card, Field, SegmentedControl } from '@/ui/controls';
import { Row, Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

export default function JarScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { jars, jarEntries, transactions, addToJar, deleteJar } = useData();
  const jar = jars.find((j) => j.id === id);
  const plan = useMemo(() => (jar ? jarPlan(jar, jarEntries, transactions) : null), [jar, jarEntries, transactions]);
  const entries = jarEntries.filter((e) => e.jar_id === id);
  const [mode, setMode] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!jar || !plan) {
    return (
      <Screen title="Jar" largeTitle={false} back="Jars" tabBar={false}>
        <Text color="secondaryLabel" align="center" style={{ marginTop: 40 }}>
          This jar isn’t loaded.
        </Text>
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

  const status =
    plan.status === 'done'
      ? 'Full! Time to enjoy it.'
      : plan.status === 'no_date'
        ? `${money(plan.left, { whole: true })} to go, no deadline.`
        : plan.status === 'overdue'
          ? `The date has passed with ${money(plan.left, { whole: true })} to go. Set a new date by creating a new jar, or keep filling this one.`
          : `${money(plan.left, { whole: true })} to go in ${plan.daysLeft} days: about ${money(plan.perWeek!, { whole: true })} a week (${money(plan.perMonth!, { whole: true })} a month).` +
            (plan.status === 'behind' ? ` You’re behind the even pace (${money(plan.expectedByNow!, { whole: true })} by now).` : ' You’re on track.');

  return (
    <Screen title={jar.name} largeTitle={false} back="Jars" tabBar={false}>
      <JarCard
        emoji={jar.emoji ?? '🐷'}
        name={jar.name}
        saved={plan.saved}
        target={jar.target}
        progress={plan.progress}
        line={`${Math.round(plan.progress * 100)}% full${jar.target_date ? ` · by ${shortDate(new Date(jar.target_date))}` : ''}`}
      />

      <Section header="Plan">
        <View style={styles.text}>
          <Text variant="subheadline">{status}</Text>
        </View>
      </Section>

      {plan.nudge ? (
        <Card style={{ ...styles.nudge, backgroundColor: `${c.gold}22` }}>
          <Text variant="footnote" weight="700" color="orange">
            NUDGE
          </Text>
          <Text variant="subheadline">{plan.nudge.text}</Text>
        </Card>
      ) : null}

      <Section header="Update" footer={error ?? 'Moved money into savings? Add it here. Gullak can’t see transfers to your own savings automatically yet.'}>
        <View style={styles.text}>
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
        <View style={styles.text}>
          <Button title={mode === 'in' ? 'Add to Jar' : 'Take Out'} size="small" onPress={save} loading={busy} disabled={!valid} />
        </View>
      </Section>

      {entries.length ? (
        <Section header="History">
          {entries.slice(0, 30).map((e) => (
            <Row
              key={e.id}
              title={e.amount > 0 ? 'Put in' : 'Taken out'}
              subtitle={dayLabel(new Date(e.created_at))}
              value={
                <Text tabular weight="500" color={e.amount > 0 ? 'green' : 'label'}>
                  {e.amount > 0 ? '+' : '−'}
                  {money(Math.abs(e.amount), { whole: true })}
                </Text>
              }
            />
          ))}
        </Section>
      ) : null}

      <Section>
        <Row title="Delete Jar" destructive onPress={remove} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: { padding: layout.inset },
  nudge: { marginHorizontal: layout.inset, marginBottom: 24, gap: 4 },
});
