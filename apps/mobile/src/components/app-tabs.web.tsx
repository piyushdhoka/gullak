// Web build: a translucent tab bar on the cream page; the selected tab sits in a clay sticker.

import { BlurView } from 'expo-blur';
import { TabList, TabSlot, TabTrigger, Tabs, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef, type ComponentRef, type ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityIcon, SettingsIcon, SetupIcon, SummaryIcon } from '@/ui/icons';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

type Icon = ComponentType<{ color: string; size?: number; filled?: boolean }>;

const TABS: { name: string; href: '/' | '/activity' | '/setup' | '/settings'; label: string; Icon: Icon }[] = [
  { name: 'index', href: '/', label: 'Summary', Icon: SummaryIcon },
  { name: 'activity', href: '/activity', label: 'Activity', Icon: ActivityIcon },
  { name: 'setup', href: '/setup', label: 'Setup', Icon: SetupIcon },
  { name: 'settings', href: '/settings', label: 'Settings', Icon: SettingsIcon },
];

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        {/* Tabs reads the triggers from this element's direct children. */}
        <TabBar>
          {TABS.map((t) => (
            <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
              <TabButton label={t.label} Icon={t.Icon} />
            </TabTrigger>
          ))}
        </TabBar>
      </TabList>
    </Tabs>
  );
}

function TabBar({ children, style: _slotStyle, ...rest }: TabListProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View {...rest} style={[styles.bar, { height: layout.tabBarHeight + insets.bottom }]}>
      <BlurView intensity={60} tint="systemChromeMaterial" style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.chrome }]} />
      </BlurView>
      <View style={[styles.hairline, { backgroundColor: c.outline }]} />
      <View style={[styles.items, { paddingBottom: insets.bottom }]}>{children}</View>
    </View>
  );
}

const TabButton = forwardRef<ComponentRef<typeof Pressable>, TabTriggerSlotProps & { label: string; Icon: Icon }>(function TabButton(
  { isFocused, label, Icon, ...props },
  ref,
) {
  const c = useColors();
  const color = isFocused ? c.tint : c.secondaryLabel;
  return (
    <Pressable ref={ref} {...props} style={styles.button} accessibilityRole="tab" accessibilityState={{ selected: isFocused }}>
      <View
        style={[
          styles.iconWrap,
          isFocused && { backgroundColor: `${c.tint}1F`, borderColor: c.outline },
        ]}>
        <Icon color={color} filled={isFocused} size={22} />
      </View>
      <Text variant="caption2" weight={isFocused ? '700' : '500'} style={{ color: isFocused ? c.label : c.secondaryLabel }}>
        {label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  hairline: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  items: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    maxWidth: layout.maxWidth,
    alignSelf: 'center',
  },
  button: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4, gap: 1 },
  iconWrap: {
    width: 44,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
});
