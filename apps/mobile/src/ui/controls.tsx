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

import { Sticker } from './sticker';
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
  const fg = kind === 'filled' ? (tint === 'tint' ? c.onTint : '#FFFFFF') : c[tint];
  const label = loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <Text variant={size === 'large' ? 'headline' : 'subheadline'} weight="600" style={{ color: fg }}>
      {title}
    </Text>
  );
  // Big filled buttons are drawn like the mascot: pixel outline + hard shadow; pressing drops the face onto it.
  if (kind === 'filled' && size === 'large') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
        style={[{ opacity: disabled ? 0.45 : 1 }, style]}>
        {({ pressed }) => (
          <Sticker color={bg} radius={12} lift={disabled ? 0 : 4} pressed={pressed} style={styles.large}>
            {label}
          </Sticker>
        )}
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        size === 'large' ? styles.large : styles.small,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        kind === 'filled' && { borderWidth: layout.outline, borderColor: c.outline },
        style,
      ]}>
      {label}
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
    <View style={[styles.segments, { backgroundColor: c.fillTertiary }]} accessibilityRole="tablist">
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
              selected && [styles.segmentSelected, { backgroundColor: c.cardElevated, borderColor: c.outline }],
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

/**
 * A labelled text box: the label sits above a solid, outlined field so it's always obvious where to type.
 * Focus turns the outline and label clay. Password fields get a Show / Hide toggle inside the box.
 * Works inside a Section (as a row) or on its own.
 */
export function Field({ label, hint, ...props }: TextInputProps & { label?: string; hint?: string }) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  const secret = !!props.secureTextEntry;
  return (
    <View style={styles.field}>
      {label ? (
        <Text variant="footnote" weight="600" color={focused ? 'tint' : 'secondaryLabel'} style={styles.fieldLabel}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.box,
          {
            backgroundColor: c.cardElevated,
            borderColor: focused ? c.tint : c.fieldBorder,
            // A soft clay ring outside the outline while typing.
            boxShadow: focused ? `0 0 0 3px ${c.tint}33` : undefined,
          } as ViewStyle,
          props.editable === false && { opacity: 0.55 },
        ]}>
        <TextInput
          placeholderTextColor={c.placeholder}
          selectionColor={c.tint}
          cursorColor={c.tint}
          accessibilityLabel={props.accessibilityLabel ?? label}
          {...props}
          secureTextEntry={secret && !reveal}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[type.body, styles.input, { color: c.label, fontFamily, outlineStyle: 'none' } as never, props.style]}
        />
        {secret ? (
          <Pressable
            onPress={() => setReveal((r) => !r)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
            style={({ pressed }) => [styles.reveal, pressed && { opacity: 0.5 }]}>
            <Text variant="footnote" weight="700" color="tint">
              {reveal ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {hint ? (
        <Text variant="caption1" color="secondaryLabel" style={styles.fieldHint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** A content card: the mascot's outline and hard shadow. `tone="clay"` paints it like the pot. */
export function Card({ children, style, tone }: { children: ReactNode; style?: ViewStyle; tone?: 'clay' }) {
  const c = useColors();
  return (
    <Sticker style={[styles.card, style]} color={tone === 'clay' ? c.tint : undefined}>
      {children}
    </Sticker>
  );
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
    flexDirection: 'row',
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
  segments: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  segmentSelected: {},
  field: { paddingHorizontal: layout.inset, paddingVertical: 10 },
  fieldLabel: { marginBottom: 6, marginLeft: 2 },
  fieldHint: { marginTop: 5, marginLeft: 2 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 14,
  },
  input: { flex: 1, minWidth: 0, minHeight: 46, paddingVertical: 12 },
  reveal: { paddingLeft: 10, paddingVertical: 8 },
  card: { borderRadius: layout.cardRadius, padding: 16 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
});
