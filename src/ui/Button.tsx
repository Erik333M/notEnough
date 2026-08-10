import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { gradients, palette, radius } from '../theme/theme';
import type { IconName } from '../state/types';
import { PressableScale } from './Touchable';

type Variant = 'primary' | 'glass' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'md' | 'lg';
};

export const Button = memo(function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
  size = 'md',
}: Props) {
  const height = size === 'lg' ? 56 : 48;
  const isPrimary = variant === 'primary';
  const tint =
    variant === 'danger' ? palette.rose : isPrimary ? palette.onAccent : palette.text;

  const content = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={tint} /> : null}
          <Text style={[styles.label, { color: tint }, size === 'lg' && styles.labelLg]}>
            {label}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic={isPrimary ? 'medium' : 'light'}
      style={[{ borderRadius: radius.md }, style]}
      scaleTo={0.97}
    >
      {isPrimary ? (
        <LinearGradient
          colors={gradients.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, { height }]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.base,
            { height },
            variant === 'ghost' ? styles.ghost : styles.glass,
            variant === 'danger' && styles.danger,
          ]}
        >
          {content}
        </View>
      )}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  glass: {
    backgroundColor: palette.glassStrong,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairlineStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: palette.roseSoft,
    borderColor: 'rgba(255,122,143,0.35)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  labelLg: {
    fontSize: 16,
  },
});
