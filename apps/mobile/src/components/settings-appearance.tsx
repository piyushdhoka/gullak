// Settings › Appearance: System / Light / Dark, saved on this device.

import { StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/ui/controls';
import { setThemePref, useThemePref, type ThemePref } from '@/ui/theme-pref';
import { layout } from '@/ui/theme';

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function AppearancePicker() {
  const pref = useThemePref();
  return (
    <View style={styles.wrap} accessibilityLabel="Appearance">
      <SegmentedControl options={OPTIONS} value={pref} onChange={setThemePref} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: layout.inset - 4 },
});
