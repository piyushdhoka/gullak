import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

import { displayWeight, fontStyle, type, useColors, type ColorName, type TypeStyle } from './theme';

// The font (family + weight) is applied last so a stray fontWeight in `style` can't fake-bold it.

export interface AppTextProps extends TextProps {
  variant?: TypeStyle;
  color?: ColorName;
  weight?: '400' | '500' | '600' | '700' | '800';
  /** Display style for the name and large titles: medium weight, tight tracking. */
  display?: boolean;
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
  const size = (StyleSheet.flatten(style)?.fontSize as number | undefined) ?? type[variant].fontSize;
  return (
    <RNText
      {...rest}
      {...({ lang } as object)}
      style={[
        type[variant],
        { color: c[color] },
        // Geist is set tight at display sizes.
        display && { letterSpacing: -0.025 * size },
        tabular && { fontVariant: ['tabular-nums'] },
        align && { textAlign: align },
        style,
        fontStyle(w, lang === 'hi'),
      ]}
    />
  );
}
