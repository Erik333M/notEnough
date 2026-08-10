import { memo } from 'react';
import { StyleSheet, TextInput, type TextStyle } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';

import { palette } from '../../theme/theme';
import { formatClock, formatCountdown } from './clock';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Props = {
  value: SharedValue<number>;
  mode?: 'clock' | 'countdown';
  size?: number;
  color?: string;
  style?: TextStyle;
};

/**
 * The digits are a read-only `TextInput` whose `text` prop is written from a
 * worklet. This is the only way to repaint text at 60fps in React Native
 * without a React render per frame — a `<Text>` bound to state would put
 * ~60 renders/second on the JS thread and visibly stutter the rest of the UI.
 */
export const TimerDigits = memo(function TimerDigits({
  value,
  mode = 'clock',
  size = 64,
  color = palette.text,
  style,
}: Props) {
  const animatedProps = useAnimatedProps(() => {
    const text = mode === 'countdown' ? formatCountdown(value.value) : formatClock(value.value);
    // `text` is not part of the public TextInput prop types but is supported by
    // the native component; Reanimated writes it directly.
    return { text } as never;
  });

  return (
    <AnimatedTextInput
      animatedProps={animatedProps}
      editable={false}
      defaultValue={mode === 'countdown' ? formatCountdown(value.value) : formatClock(value.value)}
      pointerEvents="none"
      underlineColorAndroid="transparent"
      accessibilityRole="text"
      style={[
        styles.digits,
        { fontSize: size, lineHeight: size * 1.16, color },
        style,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  digits: {
    fontWeight: '800',
    textAlign: 'center',
    padding: 0,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
});
