import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

import { displayWeight, fontStyle, PIXEL_SCALE, pixelFontStyle, type, useColors, type ColorName, type TypeStyle } from './theme';

// The font (family + weight) is applied last so a stray fontWeight in `style` can't fake-bold it.

export interface AppTextProps extends TextProps {
  variant?: TypeStyle;
  color?: ColorName;
  weight?: '400' | '500' | '600' | '700' | '800';
  /** Display style for the name and large titles: the pixel face. */
  display?: boolean;
  /** Pixel face at any size (amounts, numbers on charts). `display` implies it. */
  pixel?: boolean;
  /** Kept for older call sites; has no effect. */
  rounded?: boolean;
  /** Tabular numbers so amounts line up. */
  tabular?: boolean;
  align?: 'left' | 'center' | 'right';
  /** "hi" for Hindi lines: picks the Devanagari face. */
  lang?: string;
}

export function Text({
  variant = 'body',
  color = 'label',
  weight,
  display,
  pixel,
  rounded: _rounded,
  tabular,
  align,
  lang,
  style,
  ...rest
}: AppTextProps) {
  const c = useColors();
  const styleWeight = StyleSheet.flatten(style)?.fontWeight;
  const w = weight ?? styleWeight ?? (display ? displayWeight : type[variant].fontWeight);
  const flat = StyleSheet.flatten(style);
  const size = (flat?.fontSize as number | undefined) ?? type[variant].fontSize;
  const lineHeight = (flat?.lineHeight as number | undefined) ?? type[variant].lineHeight;
  const isPixel = (display || pixel) && lang !== 'hi';
  return (
    <RNText
      {...rest}
      {...({ lang } as object)}
      style={[
        type[variant],
        { color: c[color] },
        // Pixel type keeps its own spacing; only the Hindi fallback is tightened a touch.
        (display || pixel) && { letterSpacing: lang === 'hi' ? -0.01 * size : 0 },
        tabular && { fontVariant: ['tabular-nums'] },
        align && { textAlign: align },
        style,
        // Condensed pixel face: scale up so it matches the optical size of the Geist around it.
        isPixel && { fontSize: size * PIXEL_SCALE, lineHeight: Math.max(lineHeight, size * PIXEL_SCALE * 1.05) },
        display || pixel ? pixelFontStyle(lang === 'hi') : fontStyle(w, lang === 'hi'),
      ]}
    />
  );
}
