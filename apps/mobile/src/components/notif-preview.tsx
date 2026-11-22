// A notification drawn the way it lands on a phone's lock screen: the mascot as the app icon,
// "Gullak · now", the title in bold, the body, and the action buttons as chips.
// The whole card is one button (the previews in /notifications use it to demo the in-app banner).

import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sticker } from '@/ui/sticker';
import { Text } from '@/ui/text';
import { useColors } from '@/ui/theme';

export interface NotifPreviewData {
  title: string;
  body?: string;
  actions?: { action: string; title: string; url?: string }[];
}

export function NotifPreview({
  push,
  onPress,
  accessibilityHint,
}: {
  push: NotifPreviewData;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  const c = useColors();
  const actions = (push.actions ?? []).slice(0, 2);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Preview: ${push.title}. ${push.body ?? ''}`}
      accessibilityHint={accessibilityHint}>
      {({ pressed }) => (
        <Sticker pressed={pressed} radius={20} color={c.cardElevated} style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.icon, { backgroundColor: c.cream, borderColor: c.outline }]}>
              <Image source={require('../../assets/images/logo-192.png')} style={styles.mascot} contentFit="contain" />
            </View>
            <View style={styles.text}>
              <View style={styles.meta}>
                <Text variant="caption1" weight="700" color="tint">
                  Gullak
                </Text>
                <Text variant="caption1" color="tertiaryLabel">
                  · now
                </Text>
              </View>
              <Text variant="subheadline" weight="700" numberOfLines={2}>
                {push.title}
              </Text>
              {push.body ? (
                <Text variant="footnote" color="secondaryLabel" numberOfLines={3}>
                  {push.body}
                </Text>
              ) : null}
            </View>
          </View>
          {actions.length ? (
            <View style={styles.actions}>
              {actions.map((a, i) => (
                <View
                  key={a.action}
                  style={[
                    styles.chip,
                    { borderColor: c.outline, backgroundColor: i === 0 ? `${c.tint}1F` : 'transparent' },
                  ]}>
                  <Text variant="footnote" weight="600" color={i === 0 ? 'tint' : 'label'} numberOfLines={1}>
                    {a.title}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Sticker>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, gap: 10 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mascot: { width: 36, height: 36 },
  text: { flex: 1, minWidth: 0, gap: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 52 },
  chip: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '100%' },
});
