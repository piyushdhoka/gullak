// The review game's end screens: the mascot in a sticker frame and a small celebration card.

import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/ui/controls';
import { Coin, Sticker } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { layout } from '@/ui/theme';

const MASCOT = require('../../assets/images/logo-192.png');

/** The gullak mascot, framed like a sticker so its peach backdrop sits well in dark mode too. */
export function ReviewMascot({ size = 104 }: { size?: number }) {
  return (
    <Sticker radius={size * 0.24} color="#FCEFD9" style={{ alignSelf: 'center' }}>
      <Image
        source={MASCOT}
        style={{ width: size, height: size }}
        contentFit="cover"
        accessibilityLabel="Gullak, the piggy-bank pot"
      />
    </Sticker>
  );
}

export function ReviewCheer({
  title,
  body,
  bar,
  action,
  mascot,
}: {
  title: string;
  body: string;
  bar?: ReactNode;
  action: ReactNode;
  /** Replaces the default mascot-with-coins. */
  mascot?: ReactNode;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        {mascot ?? (
          <View style={styles.party}>
            <View style={[styles.coin, { transform: [{ rotate: '-14deg' }], marginTop: 18 }]}>
              <Coin size={26} />
            </View>
            <ReviewMascot />
            <View style={[styles.coin, { transform: [{ rotate: '12deg' }] }]}>
              <Coin size={30} />
            </View>
          </View>
        )}
      </View>
      <Text display variant="title1" align="center" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text variant="subheadline" color="secondaryLabel" align="center" style={styles.body}>
        {body}
      </Text>
      {bar ? <View style={styles.bar}>{bar}</View> : null}
      {action}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: layout.inset, marginTop: 16, paddingVertical: 24, paddingHorizontal: 20 },
  top: { alignItems: 'center', marginBottom: 14 },
  party: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  coin: {},
  title: { fontSize: 32, lineHeight: 40 },
  body: { marginTop: 4, marginBottom: 18 },
  bar: { marginBottom: 20 },
});
