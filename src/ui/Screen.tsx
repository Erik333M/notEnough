import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { Theme } from '../theme/tokens';
import { useStyles, useTheme } from '../theme/ThemeContext';

/**
 * The app canvas: one gradient plus two slow-drifting light orbs.
 *
 * The orbs animate transform/opacity only, entirely on the UI thread, so the
 * ambient motion costs nothing on the JS thread even while lists are scrolling.
 */
const Orb = memo(function Orb({
  color,
  size,
  top,
  left,
  delay,
}: {
  color: string;
  size: number;
  top: number;
  left: number;
  delay: number;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 14000 + delay, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [delay, drift]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.28 + drift.value * 0.16,
    transform: [
      { translateX: drift.value * 46 - 23 },
      { translateY: drift.value * -38 + 19 },
      { scale: 1 + drift.value * 0.12 },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          pointerEvents: 'none',
          position: 'absolute',
          top,
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
});

export function Screen({ children }: { children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={theme.canvas}
        locations={[0, 0.52, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/*
        Two, not three, and both faint.
        
        The old canvas had a violet, a cyan and a rose orb at a strength you
        could name the colour of. Against graphite that reads as a different
        app showing through, and it put saturated colour behind text that has
        to stay legible. What is left is a single lift of the primary and one
        of the surface — enough that the page is not a flat rectangle, not
        enough to notice unless you look for it.
      */}
      <Orb color={theme.accentSoft.body} size={320} top={-110} left={-90} delay={0} />
      <Orb color={theme.surfaceElevated} size={260} top={420} left={190} delay={2600} />
      {children}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bgDeep,
    overflow: 'hidden',
  },
});
