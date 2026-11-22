// "Matka" theme: every colour is lifted from the pixel-art gullak mascot.
// The pot's clay, the coin's gold, the sprout's green, the cream wave band and the dark pixel outline.
// Colours that get a hex alpha suffix appended (`${c.tint}26`) must stay 6-digit hex.

import { useSyncExternalStore } from 'react';
import { Platform, useColorScheme, type TextStyle } from 'react-native';

import { useThemePref } from './theme-pref';

const light = {
  /** Clay, from the pot. Buttons, links, selected tabs. */
  tint: '#D2461E',
  /** The pot's shadow side. Pressed states, the hero's lower half. */
  clayDeep: '#A8341A',
  /** The mascot's coin. The accent; used sparingly. */
  gold: '#F5A90F',
  /** The mascot's pixel outline: card edges and button borders. */
  outline: '#1C0F0C',
  /** The hard offset shadow under outlined cards. */
  shadow: '#1C0F0C',
  /** The pot's cream wave band. */
  cream: '#F7DDB0',
  /** Text and marks that sit on clay. */
  onTint: '#FFF4E2',
  background: '#FFFAF2',
  /** The page: the mascot's peach backdrop, lightened. */
  groupedBackground: '#FCEFD9',
  card: '#FFFAF2',
  cardElevated: '#FFFFFF',
  fill: 'rgba(122,62,30,0.16)',
  fillTertiary: 'rgba(122,62,30,0.09)',
  label: '#1C0F0C',
  secondaryLabel: 'rgba(28,15,12,0.62)',
  tertiaryLabel: 'rgba(28,15,12,0.34)',
  /** Placeholder text in inputs: readable, but clearly not a value. */
  placeholder: 'rgba(28,15,12,0.45)',
  /** Outline of text boxes. */
  fieldBorder: '#1C0F0C',
  separator: 'rgba(28,15,12,0.14)',
  chrome: 'rgba(252,239,217,0.88)',
  blue: '#2F74C0',
  /** The mascot's sprout: money coming in. */
  green: '#2E9A2B',
  red: '#D7352A',
  orange: '#EE7A12',
  yellow: '#E9AE06',
  pink: '#D9487C',
  purple: '#8A50BE',
  indigo: '#5057C2',
  teal: '#1F97A6',
  mint: '#1BAA90',
  cyan: '#2A9AD0',
  brown: '#966A44',
  gray: '#8A7A70',
};

// Dark: "kiln at night", the fired-clay browns of the pot, with strong contrast.
// A near-black brown page so cards clearly lift off it, crisp warm-cream edges (not muddy brown lines),
// bright cream text, and a near-black hard shadow under every sticker.
const dark: typeof light = {
  tint: '#FF7A45',
  clayDeep: '#E2581F',
  gold: '#FFC83D',
  outline: 'rgba(255,226,186,0.22)',
  shadow: '#050302',
  cream: '#FFE6BF',
  onTint: '#1A0A04',
  background: '#0E0806',
  groupedBackground: '#140C09',
  card: '#241711',
  cardElevated: '#321F16',
  fill: 'rgba(255,226,186,0.15)',
  fillTertiary: 'rgba(255,226,186,0.08)',
  label: '#FFF5EA',
  secondaryLabel: 'rgba(255,245,234,0.72)',
  tertiaryLabel: 'rgba(255,245,234,0.44)',
  placeholder: 'rgba(255,245,234,0.46)',
  fieldBorder: 'rgba(255,226,186,0.4)',
  separator: 'rgba(255,226,186,0.12)',
  chrome: 'rgba(20,12,9,0.9)',
  blue: '#5AA8FF',
  green: '#5FD87A',
  red: '#FF5D5D',
  orange: '#FF9A3D',
  yellow: '#FFD23D',
  pink: '#FF6FA6',
  purple: '#B98CFF',
  indigo: '#8C92FF',
  teal: '#3FD0DC',
  mint: '#4FE3C4',
  cyan: '#5CCBFF',
  brown: '#D9A577',
  gray: '#9CA0BC',
};

export type Palette = typeof light;
export type ColorName = keyof Palette;

// Web pages are pre-rendered on the server, where there is no dark/light preference. Reading the scheme
// with useSyncExternalStore makes React render the server value ('light') while hydrating and then
// re-render with the browser's real preference, instead of keeping the server's light styles.
const DARK_QUERY = '(prefers-color-scheme: dark)';
function subscribeScheme(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
const readScheme = (): 'light' | 'dark' =>
  typeof window !== 'undefined' && window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';

/** 'light' | 'dark': the Appearance choice in Settings, or the phone's setting when it's "System". Hydration-safe on the web. */
export function useScheme(): 'light' | 'dark' {
  const pref = useThemePref();
  const native = useColorScheme();
  const web = useSyncExternalStore(subscribeScheme, readScheme, () => 'light' as const);
  if (pref !== 'system') return pref;
  return Platform.OS === 'web' ? web : native === 'dark' ? 'dark' : 'light';
}

export function useColors(): Palette {
  return useScheme() === 'dark' ? dark : light;
}

// Geist for Latin, Noto Sans Devanagari for Hindi. Each weight is its own loaded family.
// On the web the browser falls back per glyph, so mixed English + Hindi text just works;
// native needs the Devanagari family set explicitly (`lang="hi"` on <Text>).
type Weight = '400' | '500' | '600' | '700';

function nearest(weight: string | number | undefined): Weight {
  const n = Number(weight ?? 400) || 400;
  return n >= 700 ? '700' : n >= 600 ? '600' : n >= 500 ? '500' : '400';
}

const GEIST: Record<Weight, string> = {
  '400': 'Geist_400Regular',
  '500': 'Geist_500Medium',
  '600': 'Geist_600SemiBold',
  '700': 'Geist_700Bold',
};
const DEVANAGARI: Record<Weight, string> = {
  '400': 'NotoSansDevanagari_400Regular',
  '500': 'NotoSansDevanagari_500Medium',
  '600': 'NotoSansDevanagari_600SemiBold',
  '700': 'NotoSansDevanagari_700Bold',
};

const WEB_STACK = `Geist, 'Noto Sans Devanagari', -apple-system, system-ui, sans-serif`;

/** Font family for a weight. Web uses one variable font (weight set separately); native a family per weight. */
export function bodyFont(weight?: string | number, hindi = false): string {
  const w = nearest(weight);
  if (Platform.OS !== 'web') return hindi ? DEVANAGARI[w] : GEIST[w];
  return WEB_STACK;
}

/** fontFamily + fontWeight for a weight, ready to spread into a text style. */
export function fontStyle(weight?: string | number, hindi = false): { fontFamily: string; fontWeight: TextStyle['fontWeight'] } {
  const w = nearest(weight);
  // Native: the weight lives in the font file, so a synthetic bold must not be added on top.
  return { fontFamily: bodyFont(w, hindi), fontWeight: Platform.OS === 'web' ? w : 'normal' };
}

/** Large titles and the name: Geist at a lighter weight with tight tracking. */
export const displayWeight: Weight = '500';

// Jersey 10: the mascot's pixel art, as type. A scoreboard-style pixel face whose digits can't be
// misread (amounts are the point of this app). Only for display text: large titles, big amounts,
// the wordmark. One weight; Devanagari falls back per glyph on the web, and to Noto on native.
const PIXEL_NATIVE = 'Jersey10_400Regular';
const PIXEL_WEB = `'Jersey 10', ${WEB_STACK}`;

/** Jersey 10 is condensed with a small x-height: pixel text is drawn this much larger than its nominal size. */
export const PIXEL_SCALE = 1.25;

/** fontFamily + fontWeight for the pixel display face. */
export function pixelFontStyle(hindi = false): { fontFamily: string; fontWeight: TextStyle['fontWeight'] } {
  if (Platform.OS !== 'web') return { fontFamily: hindi ? DEVANAGARI['600'] : PIXEL_NATIVE, fontWeight: 'normal' };
  return { fontFamily: PIXEL_WEB, fontWeight: '400' };
}

/** Plain body font, for inputs. */
export const fontFamily = bodyFont('400');

export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.35 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: 0.38 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.32 },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.24 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400', letterSpacing: 0.07 },
} satisfies Record<string, TextStyle>;

export type TypeStyle = keyof typeof type;

export const layout = {
  /** Inset-grouped list side margin. */
  inset: 16,
  radius: 14,
  cardRadius: 16,
  /** Outline width on cards, groups and big buttons: the mascot's pixel edge. */
  outline: 2,
  /** How far the hard shadow sits below-right of an outlined card. */
  lift: 3,
  rowMinHeight: 44,
  maxWidth: 640,
  tabBarHeight: 54,
};
