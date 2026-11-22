// Gullak Jars: savings goals. Each jar has a target, an optional date, a plan and a nudge.

import { jarPlan } from '@gullak/core/jars.ts';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useData } from '@/lib/data';
import { money } from '@/lib/format';
import { JarCard } from '@/components/jar-card';
import { Button, Field } from '@/ui/controls';
import { Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

const EMOJIS = ['🏖️', '✈️', '📱', '💻', '🎁', '🏍️', '🎓', '💍', '🏠', '🪔', '🛟', '🐷'];

/** Deadline presets: months from now, or none. */
const WHEN = [
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
  { label: 'No date', months: 0 },
];

function dateIn(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function JarsScreen() {
  const { jars, jarEntries, transactions } = useData();
  const [creating, setCreating] = useState(false);
  const plans = useMemo(() => jars.map((j) => ({ jar: j, plan: jarPlan(j, jarEntries, transactions) })), [jars, jarEntries, transactions]);
  const total = plans.reduce((n, p) => n + p.plan.saved, 0);

  return (
    <Screen title="Gullak Jars" largeTitle={false} back="Back" tabBar={false}>
      <Text variant="subheadline" color="secondaryLabel" style={styles.intro}>
        {jars.length
          ? `${money(total, { whole: true })} saved across ${jars.length} jar${jars.length === 1 ? '' : 's'}.`
          : 'Save for something specific. Gullak works out how much to put away each week and where you could spend a little less.'}
      </Text>

      {plans.map(({ jar, plan }) => (
        <JarCard
          key={jar.id}
          emoji={jar.emoji ?? '🐷'}
          name={jar.name}
          saved={plan.saved}
          target={jar.target}
          progress={plan.progress}
          line={
            plan.status === 'done'
              ? 'Full! Time to enjoy it.'
              : plan.perWeek != null
                ? `${money(plan.perWeek, { whole: true })} a week · ${plan.daysLeft} days left${plan.status === 'behind' ? ' · behind' : ''}`
                : plan.status === 'overdue'
                  ? 'Past its date'
                  : `${money(plan.left, { whole: true })} to go`
          }
          warn={plan.status === 'behind' || plan.status === 'overdue'}
          onPress={() => router.push({ pathname: '/jar', params: { id: jar.id } })}
        />
      ))}

      {creating ? <NewJar onDone={() => setCreating(false)} /> : (
        <View style={styles.pad}>
          <Button title={jars.length ? 'New Jar' : 'Start a Jar'} kind={jars.length ? 'tinted' : 'filled'} onPress={() => setCreating(true)} />
        </View>
      )}
    </Screen>
  );
}

function NewJar({ onDone }: { onDone: () => void }) {
  const c = useColors();
  const { addJar } = useData();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [months, setMonths] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = Number(target.replace(/[,\s₹]/g, ''));
  const valid = name.trim().length > 0 && Number.isFinite(amount) && amount > 0 && amount <= 1e8;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await addJar({ name: name.trim(), emoji, target: Math.round(amount * 100) / 100, target_date: months ? dateIn(months) : null });
      onDone();
      router.push({ pathname: '/jar', params: { id } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section header="New jar" footer={error ?? undefined}>
        <Field label="For" value={name} onChangeText={setName} placeholder="Goa trip" maxLength={40} autoFocus />
        <Field label="Target ₹" value={target} onChangeText={(v) => setTarget(v.replace(/[^\d.,]/g, ''))} placeholder="30000" keyboardType="decimal-pad" />
      </Section>
      <Section header="By when">
        <View style={styles.chips}>
          {WHEN.map((w) => (
            <Pressable
              key={w.label}
              onPress={() => setMonths(w.months)}
              accessibilityRole="radio"
              accessibilityState={{ selected: months === w.months }}
              style={[styles.chip, { backgroundColor: months === w.months ? c.tint : c.fillTertiary }]}>
              <Text variant="footnote" weight="600" style={{ color: months === w.months ? '#fff' : c.label }}>
                {w.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>
      <Section header="Icon">
        <View style={styles.chips}>
          {EMOJIS.map((e) => (
            <Pressable
              key={e}
              onPress={() => setEmoji(e)}
              accessibilityRole="radio"
              accessibilityState={{ selected: emoji === e }}
              style={[styles.emojiPick, { borderColor: emoji === e ? c.tint : 'transparent' }]}>
              <Text style={{ fontSize: 24 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
      </Section>
      <View style={[styles.pad, styles.row]}>
        <Button title="Create Jar" onPress={save} loading={busy} disabled={!valid} style={{ flex: 1 }} />
        <Button title="Cancel" kind="plain" onPress={onDone} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: layout.inset + 4, marginBottom: 20 },
  pad: { marginHorizontal: layout.inset, marginBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { marginHorizontal: layout.inset, marginBottom: 12, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 30 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  emojiPick: { width: 44, height: 44, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
