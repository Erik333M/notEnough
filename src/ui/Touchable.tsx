import * as Haptics from 'expo-haptics';
import { memo, useCallback } from 'react';
import { Platform, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '../theme/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Scale at the bottom of the press. Smaller targets want less travel. */
  scaleTo?: number;
  haptic?: 'light' | 'medium' | 'heavy' | 'selection' | 'none';
  hitSlop?: number;
  /**
   * `none` is for pressable *containers* that hold their own buttons. Nesting
   * interactive roles is ambiguous for screen readers, and react-native-web
   * renders it as a `<button>` inside a `<button>`, which is invalid HTML.
   */
  accessibilityRole?: 'button' | 'switch' | 'link' | 'tab' | 'none';
  accessibilityLabel?: string;
};

/**
 * Press feedback that never touches the JS thread: the scale/opacity springs
 * live in shared values, so a press stays responsive even if JS is busy.
 */
export const PressableScale = memo(function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  disabled,
  scaleTo = 0.96,
  haptic = 'light',
  hitSlop = 6,
  accessibilityRole = 'button',
  accessibilityLabel,
}: Props) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
    opacity: 1 - pressed.value * 0.12,
  }));

  const handlePressIn = useCallback(() => {
    pressed.value = withTiming(1, { duration: motion.fast });
  }, [pressed]);

  const handlePressOut = useCallback(() => {
    pressed.value = withSpring(0, motion.spring);
  }, [pressed]);

  const handlePress = useCallback(() => {
    if (haptic !== 'none' && Platform.OS !== 'web') {
      if (haptic === 'selection') {
        Haptics.selectionAsync().catch(() => {});
      } else {
        const style =
          haptic === 'heavy'
            ? Haptics.ImpactFeedbackStyle.Heavy
            : haptic === 'medium'
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light;
        Haptics.impactAsync(style).catch(() => {});
      }
    }
    onPress?.();
  }, [haptic, onPress]);

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={hitSlop}
      onLongPress={onLongPress}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle, disabled && { opacity: 0.45 }]}
    >
      {children}
    </AnimatedPressable>
  );
});
