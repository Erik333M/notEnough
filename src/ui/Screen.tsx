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

import { gradients, palette } from '../theme/theme';

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
      pointerEvents="none"
      style={[
        {
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
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradients.canvas}
        locations={[0, 0.52, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Orb color="rgba(139,107,255,0.55)" size={300} top={-90} left={-70} delay={0} />
      <Orb color="rgba(63,224,232,0.30)" size={240} top={220} left={210} delay={2600} />
      <Orb color="rgba(255,122,143,0.22)" size={260} top={560} left={-60} delay={5200} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bg0,
    overflow: 'hidden',
  },
});
