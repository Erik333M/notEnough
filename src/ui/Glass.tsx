import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, shadow } from '../theme/theme';
import type { Theme } from '../theme/tokens';
import { useStyles, useTheme } from '../theme/ThemeContext';

type Tone = 'default' | 'strong' | 'sunken';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: Tone;
  /** Adds the top-edge specular highlight that sells the glass look. */
  sheen?: boolean;
  radiusSize?: number;
  padded?: boolean;
  elevated?: boolean;
};

/**
 * Glass surface.
 *
 * Deliberately composited with a translucent fill + hairline border + gradient
 * sheen rather than a real backdrop blur: `expo-blur` on Android needs a
 * `BlurTargetView` and repaints the whole subtree every frame, which is the
 * fastest way to make a scrolling list stutter. Real blur is reserved for the
 * few static chrome surfaces (tab bar, menu) in `GlassChrome`.
 */
export const GlassCard = memo(function GlassCard({
  children,
  style,
  tone = 'default',
  sheen = true,
  radiusSize = radius.lg,
  padded = true,
  elevated = false,
}: Props) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const fill =
    tone === 'strong' ? theme.surfaceElevated : tone === 'sunken' ? theme.surfaceSunken : theme.surface;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: fill,
          borderRadius: radiusSize,
          padding: padded ? 16 : 0,
        },
        elevated && shadow.card,
        style,
      ]}
    >
      {sheen && (
        <LinearGradient
          colors={theme.sheen}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[
            StyleSheet.absoluteFill,
            { pointerEvents: 'none', borderRadius: radiusSize, opacity: 0.5 },
          ]}
        />
      )}
      {children}
    </View>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.border,
    overflow: 'hidden',
  },
});
