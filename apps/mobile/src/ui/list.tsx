// Inset-grouped list: Section > Row, like Settings.app, drawn as an outlined sticker.

import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View, type ViewStyle } from 'react-native';

import { Chevron } from './icons';
import { Sticker } from './sticker';
import { Text } from './text';
import { layout, useColors, type ColorName } from './theme';

export function Section({
  header,
  footer,
  children,
  style,
  inset = true,
}: {
  header?: string;
  footer?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
  /** Indent separators past a leading icon. */
  inset?: boolean;
}) {
  const c = useColors();
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.section, style]}>
      {header ? (
        <Text variant="footnote" weight="600" color="secondaryLabel" style={styles.header} accessibilityRole="header">
          {header}
        </Text>
      ) : null}
      <Sticker radius={layout.radius}>
        {items.map((child, i) => (
          <Fragment key={child.key ?? i}>
            {child}
            {i < items.length - 1 ? (
              <View
                style={[
                  styles.separator,
                  { backgroundColor: c.separator, marginLeft: inset ? 60 : layout.inset },
                ]}
              />
            ) : null}
          </Fragment>
        ))}
      </Sticker>
      {footer ? (
        typeof footer === 'string' ? (
          <Text variant="footnote" color="secondaryLabel" style={styles.footer}>
            {footer}
          </Text>
        ) : (
          <View style={styles.footer}>{footer}</View>
        )
      ) : null}
    </View>
  );
}

export interface RowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  tint?: ColorName;
  checked?: boolean;
  disabled?: boolean;
}

export function Row({
  title,
  subtitle,
  value,
  left,
  right,
  onPress,
  chevron,
  destructive,
  tint,
  checked,
  disabled,
}: RowProps) {
  const c = useColors();
  const titleColor: ColorName = destructive ? 'red' : tint ?? 'label';
  const content = (pressed: boolean) => (
    <View style={[styles.row, pressed && { backgroundColor: c.fill }, disabled && { opacity: 0.4 }]}>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.middle}>
        {typeof title === 'string' ? (
          <Text color={titleColor} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle ? (
          typeof subtitle === 'string' ? (
            <Text variant="subheadline" color="secondaryLabel" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {value != null ? (
        typeof value === 'string' || typeof value === 'number' ? (
          <Text color="secondaryLabel" numberOfLines={1} style={styles.value}>
            {value}
          </Text>
        ) : (
          value
        )
      ) : null}
      {right}
      {checked ? <Text color="tint" weight="600">✓</Text> : null}
      {chevron ? <Chevron color={c.tertiaryLabel} /> : null}
    </View>
  );
  if (!onPress) return content(false);
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button">
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

export function SwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  left,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  left?: ReactNode;
}) {
  const c = useColors();
  return (
    <Row
      title={title}
      subtitle={subtitle}
      left={left}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: c.fill, true: c.green }}
          thumbColor="#FFFFFF"
          {...({ activeThumbColor: '#FFFFFF' } as object)}
        />
      }
    />
  );
}

/** A rounded-square coloured icon, as used in Settings.app. */
export function IconTile({ color, children, size = 30 }: { color: string; children: ReactNode; size?: number }) {
  const c = useColors();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        backgroundColor: color,
        borderWidth: 1.5,
        borderColor: c.outline,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: layout.inset, marginBottom: 35 },
  header: { paddingHorizontal: layout.inset, paddingBottom: 7 },
  footer: { paddingHorizontal: layout.inset, paddingTop: 7 },
  separator: { height: StyleSheet.hairlineWidth, marginRight: 0 },
  row: {
    minHeight: layout.rowMinHeight,
    paddingHorizontal: layout.inset,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  left: { width: 32, alignItems: 'center' },
  middle: { flex: 1, minWidth: 0, gap: 1 },
  value: { flexShrink: 1, maxWidth: '55%' },
});
