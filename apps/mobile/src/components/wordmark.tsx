// The logotype "Gulलक": one word, Latin "Gul" in Geist + Devanagari "लक" in Noto Sans Devanagari.
// With `hindi={false}` (inside the app) it's the plain English "Gullak".

import { APP_NAME, WORDMARK } from '@/lib/app';
import { Text } from '@/ui/text';
import { type ColorName } from '@/ui/theme';

export function Wordmark({
  size = 44,
  color = 'label',
  hindi = true,
}: {
  size?: number;
  color?: ColorName;
  /** Mixed-script logotype. Off inside the app, where the UI is English-only. */
  hindi?: boolean;
}) {
  return (
    <Text
      display
      color={color}
      align="center"
      accessibilityRole="header"
      accessibilityLabel={APP_NAME}
      style={{ fontSize: size, lineHeight: size * 1.35 }}>
      {hindi ? (
        <>
          {WORDMARK.latin}
          <Text display color={color} lang="hi" style={{ fontSize: size * 1.04 }}>
            {WORDMARK.devanagari}
          </Text>
        </>
      ) : (
        APP_NAME
      )}
    </Text>
  );
}
