import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Text } from './text';
import { fontFamily, layout, type, useColors, type ColorName } from './theme';

type ButtonKind = 'filled' | 'tinted' | 'gray' | 'plain';

export function Button({
  title,
  onPress,
  kind = 'filled',
  tint = 'tint',
  loading,
  disabled,
  style,
  size = 'large',
}: {
  title: string;
  onPress?: () => void;
  kind?: ButtonKind;
  tint?: ColorName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  size?: 'large' | 'small';
}) {
  const c = useColors();
  const bg =
    kind === 'filled' ? c[tint] : kind === 'tinted' ? `${c[tint]}26` : kind === 'gray' ? c.fillTertiary : 'transparent';
  const fg = kind === 'filled' ? '#FFFFFF' : c[tint];
  // Big filled buttons are drawn like the mascot: dark pixel outline + hard offset shadow.
  const pixel = kind === 'filled' && size === 'large' && !disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        size === 'large' ? styles.large : styles.small,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pixel ? 1 : pressed ? 0.7 : 1 },
        pixel && {
          borderWidth: 2,
          borderColor: c.outline,
          shadowColor: c.outline,
          shadowOpacity: 1,
          shadowRadius: 0,
          shadowOffset: pressed ? { width: 1, height: 1 } : { width: 4, height: 4 },
          transform: pressed ? [{ translateX: 3 }, { translateY: 3 }] : [],
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text variant={size === 'large' ? 'headline' : 'subheadline'} weight="600" style={{ color: fg }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <View style={[styles.segments, { backgroundColor: c.fillTertiary }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[
              styles.segment,
              selected && [styles.segmentSelected, { backgroundColor: c.cardElevated }],
            ]}>
            <Text variant="footnote" weight={selected ? '600' : '500'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label?: string }) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      {label ? (
        <Text variant="body" style={styles.fieldLabel}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={c.tertiaryLabel}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          type.body,
          styles.input,
          { color: c.label, fontFamily },
          focused && { outlineStyle: 'none' as never },
          props.style,
        ]}
      />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.card }, style]}>{children}</View>;
}

export function Badge({ text, tint = 'tint' }: { text: string; tint?: ColorName }) {
  const c = useColors();
  return (
    <View style={[styles.badge, { backgroundColor: `${c[tint]}22` }]}>
      <Text variant="caption1" weight="600" style={{ color: c[tint] }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  large: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  small: {
    minHeight: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  segments: { flexDirection: 'row', borderRadius: 9, padding: 2, gap: 2 },
  segment: { flex: 1, minHeight: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  segmentSelected: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.rowMinHeight,
    paddingHorizontal: layout.inset,
    gap: 12,
  },
  fieldLabel: { width: 90 },
  input: { flex: 1, paddingVertical: 11, minWidth: 0 },
  card: { borderRadius: layout.cardRadius, padding: 16 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
});
