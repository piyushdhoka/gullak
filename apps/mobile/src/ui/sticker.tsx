// The mascot's look as building blocks: a dark pixel outline with a hard offset shadow ("sticker"),
// a progress bar made of pixel blocks, and the cream wave-and-dots band painted round the pot.
// Drawn with plain Views + react-native-svg so they look the same on iOS, Android and the web
// (Android's elevation can't do a hard, offset shadow).

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { layout, useColors } from './theme';

// Style keys that position the sticker in its parent; everything else styles the face.
const OUTER_KEYS = new Set([
  'margin',
  'marginHorizontal',
  'marginVertical',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginEnd',
  'width',
  'maxWidth',
  'minWidth',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'zIndex',
]);

/** Split a style into the part that places the sticker (margins, size) and the part for its face. */
export function splitStyle(style: StyleProp<ViewStyle>): [ViewStyle, ViewStyle] {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) (OUTER_KEYS.has(k) ? outer : inner)[k] = v;
  return [outer as ViewStyle, inner as ViewStyle];
}

export function Sticker({
  children,
  style,
  color,
  radius = layout.cardRadius,
  lift = layout.lift,
  pressed = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Face colour; defaults to the card colour. */
  color?: string;
  radius?: number;
  /** Shadow offset. 0 draws the outline only. */
  lift?: number;
  /** Pressed: the face drops onto its shadow. */
  pressed?: boolean;
}) {
  const c = useColors();
  const [outer, inner] = splitStyle(style);
  const drop = pressed ? lift : 0;
  return (
    <View style={[{ paddingRight: lift, paddingBottom: lift }, outer]}>
      {lift > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.shadow, { left: lift, top: lift, borderRadius: radius, backgroundColor: c.shadow }]}
        />
      ) : null}
      <View
        style={[
          styles.face,
          {
            borderRadius: radius,
            borderColor: c.outline,
            backgroundColor: color ?? c.card,
            transform: drop ? [{ translateX: drop }, { translateY: drop }] : [],
          },
          inner,
        ]}>
        {children}
      </View>
    </View>
  );
}

/**
 * Progress as a row of pixel blocks, like a game health bar.
 * `value` is 0..1 (anything above 1 fills every block, in the over colour).
 */
export function PixelBar({
  value,
  color,
  blocks = 20,
  height = 8,
  overColor,
}: {
  value: number;
  color: string;
  blocks?: number;
  height?: number;
  overColor?: string;
}) {
  const c = useColors();
  const v = Math.max(0, value);
  // Show at least one block for anything above zero, so small amounts never look like nothing.
  const lit = v > 0 ? Math.max(1, Math.min(blocks, Math.round(v * blocks))) : 0;
  const fill = v > 1 && overColor ? overColor : color;
  return (
    <View
      style={[styles.bar, { height }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(1, v) * 100) }}>
      {Array.from({ length: blocks }, (_, i) => (
        <View key={i} style={[styles.block, { backgroundColor: i < lit ? fill : c.fillTertiary }]} />
      ))}
    </View>
  );
}

/**
 * The cream wave with dots that runs round the pot's belly. Use as a divider on clay surfaces
 * or as an underline under titles. Width-fluid: the SVG stretches to its box.
 */
export function MatkaBand({
  color,
  height = 14,
  waves = 7,
  dots = true,
  style,
}: {
  color: string;
  height?: number;
  waves?: number;
  dots?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const w = waves * 20;
  // One wave per 20 units: a crest at 5, a trough at 15. Dots sit in the troughs above the line.
  let d = `M0 7`;
  for (let i = 0; i < waves; i++) {
    const x = i * 20;
    d += ` Q${x + 5} 1 ${x + 10} 7 Q${x + 15} 13 ${x + 20} 7`;
  }
  return (
    <View style={[{ height }, style]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox={`0 0 ${w} 14`} preserveAspectRatio="none">
        <Path d={d} stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" />
        {dots
          ? Array.from({ length: waves }, (_, i) => <Circle key={i} cx={i * 20 + 15} cy={3} r={1.8} fill={color} />)
          : null}
      </Svg>
    </View>
  );
}

/** The mascot's coin, drawn in a few pixel-ish shapes. */
export function Coin({ size = 22 }: { size?: number }) {
  const c = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Circle cx={11} cy={11} r={9.5} fill={c.gold} stroke={c.outline} strokeWidth={2} />
      <Circle cx={11} cy={11} r={5.8} fill="none" stroke="#FFE08A" strokeWidth={1.6} />
      <Path d="M8.6 7.6h4.8M8.6 9.6h4.8M10 7.6c2.6 0 2.6 4-0.2 4H8.8l3.6 3.4" stroke={c.clayDeep} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute', right: 0, bottom: 0 },
  face: { borderWidth: layout.outline, overflow: 'hidden' },
  bar: { flexDirection: 'row', gap: 2 },
  block: { flex: 1, borderRadius: 1 },
});
