// Gullak Jars: savings goals. Each jar has a target, an optional date, a plan and a nudge.
// Laid out as a shelf of pixel pots, each filling with coins.

import { jarPlan, type Jar, type JarPlan } from '@gullak/core/jars.ts';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { JarStatusChip } from '@/components/jar-status';
import { PotMeter } from '@/components/pot-meter';
import { useData } from '@/lib/data';
import { money } from '@/lib/format';
import { Button, Card, Field } from '@/ui/controls';
import { Section } from '@/ui/list';
import { Screen } from '@/ui/screen';
import { Coin, MatkaBand, Sticker } from '@/ui/sticker';
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

/** The one line under a jar: what to do next. */
function jarLine(plan: JarPlan) {
  if (plan.status === 'done') return 'Time to enjoy it';
  if (plan.perWeek != null) return `${money(plan.perWeek, { whole: true })} a week · ${plan.daysLeft} days left`;
  if (plan.status === 'overdue') return `${money(plan.left, { whole: true })} still to go`;
  return `${money(plan.left, { whole: true })} to go`;
}

export default function JarsScreen() {
  const { jars, jarEntries, transactions } = useData();
  const [creating, setCreating] = useState(false);
  const plans = useMemo(() => jars.map((j) => ({ jar: j, plan: jarPlan(j, jarEntries, transactions) })), [jars, jarEntries, transactions]);
  const total = plans.reduce((n, p) => n + p.plan.saved, 0);
  const goal = plans.reduce((n, p) => n + Number(p.jar.target), 0);
  const full = plans.filter((p) => p.plan.status === 'done').length;

  // Two pots per shelf.
  const shelves: (typeof plans)[] = [];
  for (let i = 0; i < plans.length; i += 2) shelves.push(plans.slice(i, i + 2));

  return (
    <Screen title="Gullak Jars" largeTitle={false} back="Back" tabBar={false}>
      {jars.length ? (
        <>
          <Hero total={total} goal={goal} count={jars.length} full={full} />
          <Text variant="footnote" weight="600" color="secondaryLabel" style={styles.header} accessibilityRole="header">
            Your shelf
          </Text>
          <View style={styles.shelf}>
            {shelves.map((row, i) => (
              <View key={i} style={styles.shelfRow}>
                {row.map(({ jar, plan }) => (
                  <JarTile key={jar.id} jar={jar} plan={plan} />
                ))}
                {row.length === 1 ? <View style={styles.tile} /> : null}
              </View>
            ))}
          </View>
        </>
      ) : creating ? null : (
        <Empty onStart={() => setCreating(true)} />
      )}

      {creating ? (
        <NewJar onDone={() => setCreating(false)} />
      ) : jars.length ? (
        <View style={styles.pad}>
          <Button title="New Jar" kind="tinted" onPress={() => setCreating(true)} />
        </View>
      ) : null}
    </Screen>
  );
}

function Hero({ total, goal, count, full }: { total: number; goal: number; count: number; full: number }) {
  const c = useColors();
  return (
    <Card tone="clay" style={styles.hero}>
      <View style={styles.heroTop}>
        <Text variant="subheadline" weight="600" style={{ color: c.onTint, opacity: 0.85 }}>
          Saved in your jars
        </Text>
        <Coin size={26} />
      </View>
      <Text pixel style={[styles.heroAmount, { color: c.onTint }]} numberOfLines={1} adjustsFontSizeToFit>
        {money(total, { whole: true })}
      </Text>
      <MatkaBand color={c.cream} style={styles.heroBand} />
      <View style={styles.heroFoot}>
        <View style={[styles.pill, { backgroundColor: c.cream, borderColor: c.outline }]}>
          <Text variant="footnote" weight="700" style={{ color: '#1C0F0C' }}>
            {goal > 0 ? Math.round((total / goal) * 100) : 0}% of {money(goal, { whole: true })}
          </Text>
        </View>
        <Text variant="footnote" style={{ color: c.onTint, opacity: 0.85, flexShrink: 1 }}>
          {count} jar{count === 1 ? '' : 's'}
          {full ? ` · ${full} full` : ''}
        </Text>
      </View>
    </Card>
  );
}

function JarTile({ jar, plan }: { jar: Jar; plan: JarPlan }) {
  const c = useColors();
  const pct = Math.round(plan.progress * 100);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/jar', params: { id: jar.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${jar.name}: ${money(plan.saved, { whole: true })} of ${money(jar.target, { whole: true })}, ${pct}% full. ${jarLine(plan)}`}
      style={styles.tile}>
      {({ pressed }) => (
        <Sticker pressed={pressed} style={styles.tileFace}>
          <View style={styles.tileTop}>
            <Text style={styles.tileEmoji}>{jar.emoji ?? '🐷'}</Text>
            <Text pixel variant="footnote" color="secondaryLabel">
              {pct}%
            </Text>
          </View>
          <PotMeter progress={plan.progress} size={76} ground label={null} style={styles.tilePot} />
          <Text variant="headline" numberOfLines={1}>
            {jar.name}
          </Text>
          <Text pixel variant="title3" numberOfLines={1} adjustsFontSizeToFit>
            {money(plan.saved, { whole: true })}
          </Text>
          <Text variant="caption1" color="secondaryLabel" numberOfLines={1}>
            of {money(jar.target, { whole: true })}
          </Text>
          <View style={[styles.tileRule, { backgroundColor: c.separator }]} />
          <JarStatusChip plan={plan} />
          <Text variant="caption1" color="secondaryLabel" numberOfLines={2}>
            {jarLine(plan)}
          </Text>
        </Sticker>
      )}
    </Pressable>
  );
}

function Empty({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.empty}>
      <PotMeter progress={0} size={112} ground label="An empty jar" />
      <Text variant="title3" weight="600" align="center">
        An empty jar, ready
      </Text>
      <Text variant="subheadline" color="secondaryLabel" align="center" style={styles.emptyCopy}>
        Name something you want, a trip or a phone, and set a target. Gullak works out what to drop in each week and
        where you could spend a little less.
      </Text>
      <Button title="Start a Jar" onPress={onStart} style={styles.emptyButton} />
    </View>
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
        <View style={styles.chips} accessibilityRole="radiogroup">
          {WHEN.map((w) => {
            const on = months === w.months;
            return (
              <Pressable
                key={w.label}
                onPress={() => setMonths(w.months)}
                accessibilityRole="radio"
                accessibilityLabel={w.label}
                accessibilityState={{ selected: on }}
                style={[styles.chip, { backgroundColor: on ? c.tint : c.fillTertiary, borderColor: on ? c.outline : 'transparent' }]}>
                <Text variant="footnote" weight="600" style={{ color: on ? c.onTint : c.label }}>
                  {w.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>
      <Section header="Icon">
        <View style={styles.chips} accessibilityRole="radiogroup">
          {EMOJIS.map((e) => {
            const on = emoji === e;
            return (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                accessibilityRole="radio"
                accessibilityLabel={`Icon ${e}`}
                accessibilityState={{ selected: on }}
                style={[styles.emojiPick, { borderColor: on ? c.outline : 'transparent', backgroundColor: on ? `${c.gold}40` : 'transparent' }]}>
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </Pressable>
            );
          })}
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
  hero: { marginHorizontal: layout.inset, marginBottom: 24, paddingBottom: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroAmount: { fontSize: 44, lineHeight: 54, marginTop: 4 },
  heroBand: { marginTop: 6, marginBottom: 12, marginHorizontal: -2 },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  header: { paddingHorizontal: layout.inset * 2, paddingBottom: 7 },
  shelf: { paddingHorizontal: layout.inset, gap: 12, marginBottom: 20 },
  shelfRow: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, minWidth: 0 },
  tileFace: { borderRadius: layout.cardRadius, padding: 12, gap: 2, flexGrow: 1 },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileEmoji: { fontSize: 20, lineHeight: 26 },
  tilePot: { alignSelf: 'center', marginTop: -6, marginBottom: 8 },
  tileRule: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  empty: { alignItems: 'center', paddingHorizontal: layout.inset * 2, paddingTop: 24, paddingBottom: 8, gap: 10 },
  emptyCopy: { maxWidth: 420 },
  emptyButton: { alignSelf: 'stretch', marginTop: 10 },
  pad: { marginHorizontal: layout.inset, marginBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1.5, minHeight: 34, justifyContent: 'center' },
  emojiPick: { width: 44, height: 44, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
