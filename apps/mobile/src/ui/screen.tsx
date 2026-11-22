// A screen with an iOS navigation bar: a large title that collapses into a blurred inline bar.

import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackChevron } from './icons';
import { Text } from './text';
import { layout, useColors } from './theme';

const BAR = 44;

export function Screen({
  title,
  largeTitle = true,
  back,
  right,
  children,
  onRefresh,
  refreshing = false,
  tabBar = true,
  hindi,
  header,
}: {
  title: string;
  /** The screen's name in Hindi, shown under the large title. */
  hindi?: string;
  largeTitle?: boolean;
  /** Label for the back button, e.g. "Activity". */
  back?: string;
  right?: ReactNode;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Leave room for the tab bar. */
  tabBar?: boolean;
  /** Replaces the large title with custom content (e.g. the home greeting). The inline title still shows on scroll. */
  header?: ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [scrolled, setScrolled] = useState(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const next = y > (largeTitle ? (hindi ? 60 : 44) : 2);
    if (next !== scrolled) setScrolled(next);
  };
  const showInlineTitle = !largeTitle || scrolled;

  return (
    <View style={[styles.fill, { backgroundColor: c.groupedBackground }]}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{
          paddingTop: insets.top + BAR,
          paddingBottom: (tabBar ? layout.tabBarHeight : 0) + insets.bottom + 24,
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
        <View style={styles.content}>
          {header ? (
            header
          ) : largeTitle ? (
            <View style={styles.largeTitleWrap}>
              <Text display variant="largeTitle" style={styles.largeTitle} accessibilityRole="header">
                {title}
              </Text>
              {hindi ? (
                <Text variant="subheadline" color="secondaryLabel" style={styles.hindi} lang="hi">
                  {hindi}
                </Text>
              ) : null}
            </View>
          ) : null}
          {children}
        </View>
      </ScrollView>

      <View style={[styles.barWrap, { height: insets.top + BAR }]} pointerEvents="box-none">
        {scrolled ? (
          <BlurView intensity={60} tint="systemChromeMaterial" style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: c.chrome }]} />
          </BlurView>
        ) : null}
        <View style={[styles.bar, { marginTop: insets.top }]}>
          <View style={styles.side}>
            {back ? (
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Back to ${back}`}
                style={({ pressed }) => [styles.back, pressed && { opacity: 0.4 }]}>
                <BackChevron color={c.tint} />
                <Text color="tint" numberOfLines={1}>
                  {back}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text variant="headline" numberOfLines={1} style={[styles.inlineTitle, { opacity: showInlineTitle ? 1 : 0 }]}>
            {title}
          </Text>
          <View style={[styles.side, styles.sideRight]}>{right}</View>
        </View>
        {scrolled ? <View style={[styles.hairline, { backgroundColor: c.outline }]} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
  largeTitleWrap: { paddingHorizontal: layout.inset + 4, paddingTop: 3, paddingBottom: 14 },
  largeTitle: { fontSize: 38, lineHeight: 46 },
  hindi: { marginTop: -4 },
  barWrap: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  bar: {
    height: BAR,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
  },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  sideRight: { justifyContent: 'flex-end', paddingRight: 8 },
  inlineTitle: { flexShrink: 1, textAlign: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2 },
});
