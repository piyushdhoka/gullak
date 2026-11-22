// Apple Human Interface Guidelines system colours and type scale (iOS 18).

import { Platform, useColorScheme, type TextStyle } from 'react-native';

const light = {
  /** Clay, from the gullak mascot. Buttons, links, selected tabs. */
  tint: '#D2461E',
  /** The mascot's coin. The accent; used sparingly. */
  gold: '#F5A90F',
  /** The mascot's black pixel outline. */
  outline: '#1C0F0C',
  /** The pot's cream pattern. */
  cream: '#F7DDB0',
  background: '#FFFFFF',
  groupedBackground: '#F2F2F7',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  fill: 'rgba(120,120,128,0.2)',
  fillTertiary: 'rgba(118,118,128,0.12)',
  label: '#000000',
  secondaryLabel: 'rgba(60,60,67,0.6)',
  tertiaryLabel: 'rgba(60,60,67,0.3)',
  separator: 'rgba(60,60,67,0.29)',
  chrome: 'rgba(249,249,249,0.82)',
  blue: '#007AFF',
  /** The mascot's sprout: money coming in. */
  green: '#2E9A2B',
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  pink: '#FF2D55',
  purple: '#AF52DE',
  indigo: '#5856D6',
  teal: '#30B0C7',
  mint: '#00C7BE',
  cyan: '#32ADE6',
  brown: '#A2845E',
  gray: '#8E8E93',
};

const dark: typeof light = {
  tint: '#FF7A4D',
  gold: '#FFC23D',
  outline: '#000000',
  cream: '#F7DDB0',
  background: '#000000',
  groupedBackground: '#000000',
  card: '#1C1C1E',
  cardElevated: '#2C2C2E',
  fill: 'rgba(120,120,128,0.36)',
  fillTertiary: 'rgba(118,118,128,0.24)',
  label: '#FFFFFF',
  secondaryLabel: 'rgba(235,235,245,0.6)',
  tertiaryLabel: 'rgba(235,235,245,0.3)',
  separator: 'rgba(84,84,88,0.6)',
  chrome: 'rgba(22,22,22,0.82)',
  blue: '#0A84FF',
  green: '#5FD14E',
  red: '#FF453A',
  orange: '#FF9F0A',
  yellow: '#FFD60A',
  pink: '#FF375F',
  purple: '#BF5AF2',
  indigo: '#5E5CE6',
  teal: '#40C8E0',
  mint: '#63E6E2',
  cyan: '#64D2FF',
  brown: '#AC8E68',
  gray: '#8E8E93',
};

export type Palette = typeof light;
export type ColorName = keyof Palette;

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
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
  radius: 10,
  cardRadius: 16,
  rowMinHeight: 44,
  maxWidth: 640,
  tabBarHeight: 49,
};
