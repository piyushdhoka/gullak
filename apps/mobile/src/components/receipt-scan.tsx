// The receipt panel at the top of "Add a payment": scan a bill (or paste its text), read it on the phone,
// and hand the guess to the screen to fill in. Nothing is saved here; the person checks and taps Save.

import { parseReceipt, type ReceiptGuess } from '@gullak/core/receipt.ts';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { canScanReceipts, pickReceiptPhoto, readReceiptText, type ScanProgress } from '@/lib/receipt-ocr';
import { Button } from '@/ui/controls';
import { Glyph } from '@/ui/glyphs';
import { Sticker } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { useColors } from '@/ui/theme';

type State =
  | { phase: 'idle' }
  | { phase: 'paste' }
  | { phase: 'reading'; progress: ScanProgress }
  | { phase: 'done'; guess: ReceiptGuess }
  | { phase: 'failed'; message: string };

export function ReceiptScan({ initialFile, onGuess }: { initialFile?: File | null; onGuess: (g: ReceiptGuess) => void }) {
  const c = useColors();
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [pasted, setPasted] = useState('');
  const started = useRef(false);
  const alive = useRef(true);

  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const read = async (file: File) => {
    setState({ phase: 'reading', progress: { stage: 'loading', progress: 0 } });
    try {
      const text = await readReceiptText(file, (progress) => alive.current && setState({ phase: 'reading', progress }));
      if (!alive.current) return;
      finish(text);
    } catch (e) {
      if (alive.current) setState({ phase: 'failed', message: (e as Error).message || 'Couldn’t read that photo.' });
    }
  };

  const finish = (text: string) => {
    const guess = parseReceipt(text);
    if (guess.amount === null && !guess.merchant && !guess.date) {
      setState({ phase: 'failed', message: 'Couldn’t find anything on that receipt. Try a flat, well-lit photo of the whole bill.' });
      return;
    }
    onGuess(guess);
    setState({ phase: 'done', guess });
  };

  // Opened from the camera button on home: the photo is already taken.
  useEffect(() => {
    if (initialFile && !started.current) {
      started.current = true;
      read(initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  const scan = () => {
    pickReceiptPhoto().then((file) => file && read(file));
  };

  if (!canScanReceipts) return null;

  if (state.phase === 'reading') {
    const { stage, progress } = state.progress;
    // Loading the engine is the first third of the bar, reading the rest.
    const pct = Math.round((stage === 'loading' ? progress * 0.3 : 0.3 + progress * 0.7) * 100);
    return (
      <View style={[styles.box, { backgroundColor: c.fillTertiary, borderColor: c.separator }]} accessibilityLiveRegion="polite">
        <Text variant="subheadline" weight="600">
          {stage === 'loading' ? 'Getting the scanner ready…' : 'Reading your receipt…'}
        </Text>
        <View style={[styles.track, { backgroundColor: c.separator }]}>
          <View style={[styles.fill, { width: `${Math.max(4, pct)}%`, backgroundColor: c.tint }]} />
        </View>
        <Text variant="caption1" color="secondaryLabel">
          {stage === 'loading' ? 'The first scan downloads the scanner once. ' : ''}The photo stays on your phone.
        </Text>
      </View>
    );
  }

  if (state.phase === 'paste') {
    return (
      <View style={[styles.box, { backgroundColor: c.fillTertiary, borderColor: c.separator }]}>
        <Text variant="caption1" weight="600" color="secondaryLabel">
          Tip: in Photos, press and hold the receipt’s text, tap Select All, then Copy.
        </Text>
        <TextInput
          value={pasted}
          onChangeText={setPasted}
          placeholder="Paste the receipt’s text here"
          placeholderTextColor={c.tertiaryLabel}
          multiline
          autoFocus
          maxLength={6000}
          accessibilityLabel="Receipt text"
          style={[styles.paste, { color: c.label, borderColor: c.separator, backgroundColor: c.card }]}
        />
        <View style={styles.row}>
          <Button title="Cancel" kind="gray" size="small" onPress={() => setState({ phase: 'idle' })} style={styles.flex} />
          <Button title="Use this text" size="small" disabled={!pasted.trim()} onPress={() => finish(pasted)} style={styles.flex} />
        </View>
      </View>
    );
  }

  if (state.phase === 'done' || state.phase === 'failed') {
    const missing =
      state.phase === 'done'
        ? [
            state.guess.amount === null ? 'the total' : null,
            !state.guess.date ? 'the date' : null,
            !state.guess.merchant ? 'the shop name' : null,
          ].filter(Boolean)
        : [];
    return (
      <View
        style={[styles.box, { backgroundColor: state.phase === 'done' ? `${c.tint}14` : c.fillTertiary, borderColor: c.separator }]}
        accessibilityLiveRegion="polite">
        {state.phase === 'done' ? (
          <>
            <Text variant="subheadline" weight="600">
              Filled in from your receipt. Check it before saving.
            </Text>
            {missing.length ? (
              <Text variant="footnote" color="secondaryLabel">
                Couldn’t find {missing.join(', ').replace(/, ([^,]*)$/, ' or $1')}. Fill {missing.length > 1 ? 'them' : 'it'} in below.
              </Text>
            ) : null}
            {state.guess.amount !== null && !state.guess.amountSure ? (
              <Text variant="footnote" color="secondaryLabel">
                The total wasn’t labelled clearly, so double-check the amount.
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="subheadline" weight="600">
            {state.message}
          </Text>
        )}
        <View style={styles.row}>
          <Button title="Scan another" kind="gray" size="small" onPress={scan} style={styles.flex} />
          {/* After a scan that worked, only "Scan another"; pasting text stays as a fallback when nothing was read. */}
          {state.phase === 'failed' ? (
            <Button title="Paste text" kind="gray" size="small" onPress={() => setState({ phase: 'paste' })} style={styles.flex} />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <ScanChoice label="Scan receipt" hint="Photo or camera" icon onPress={scan} />
      <ScanChoice label="Paste text" hint="From Photos" onPress={() => setState({ phase: 'paste' })} />
    </View>
  );
}

function ScanChoice({ label, hint, icon, onPress }: { label: string; hint: string; icon?: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}. ${hint}`} style={styles.flex}>
      {({ pressed }) => (
        <Sticker color={c.card} radius={14} pressed={pressed} style={styles.choice}>
          {icon ? <Glyph name="camera" size={22} color={c.tint} /> : null}
          <View style={styles.flex}>
            <Text variant="subheadline" weight="700" numberOfLines={1}>
              {label}
            </Text>
            <Text variant="caption1" color="secondaryLabel" numberOfLines={1}>
              {hint}
            </Text>
          </View>
        </Sticker>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  box: { borderRadius: 12, borderWidth: 1.5, padding: 12, gap: 8 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  paste: { minHeight: 120, borderWidth: 1.5, borderRadius: 10, padding: 10, fontSize: 15, textAlignVertical: 'top' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, minHeight: 56 },
});
