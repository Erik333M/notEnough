import { Ionicons } from '@expo/vector-icons';
import { forwardRef, memo, useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { motion, palette, radius } from '../theme/theme';
import type { IconName } from '../state/types';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  icon?: IconName;
  secure?: boolean;
  error?: string | null;
  autoComplete?: TextInputProps['autoComplete'];
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  autoCapitalize?: TextInputProps['autoCapitalize'];
};

/**
 * Glass text field with an animated focus ring and a shake on error.
 * Both animations are shared-value driven so typing never re-renders the ring.
 */
export const Field = forwardRef<TextInput, Props>(function Field(
  {
    label,
    value,
    onChangeText,
    placeholder,
    icon,
    secure = false,
    error,
    autoComplete,
    keyboardType,
    returnKeyType,
    onSubmitEditing,
    autoCapitalize = 'none',
  },
  ref,
) {
  const [hidden, setHidden] = useState(secure);
  const focus = useSharedValue(0);
  const shake = useSharedValue(0);

  const onFocus = useCallback(() => {
    focus.value = withTiming(1, { duration: motion.fast });
  }, [focus]);

  const onBlur = useCallback(() => {
    focus.value = withTiming(0, { duration: motion.fast });
  }, [focus]);

  const hasError = Boolean(error);

  // Shake once whenever a new error arrives. Kept in an effect so the shared
  // value is never mutated during render.
  useEffect(() => {
    if (!error) return;
    shake.value = withSequence(
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 60 }),
      withTiming(-4, { duration: 55 }),
      withSpring(0, motion.spring),
    );
  }, [error, shake]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
    borderColor: hasError
      ? 'rgba(255,122,143,0.65)'
      : interpolateColor(focus.value, [0, 1], [palette.hairline, 'rgba(139,107,255,0.75)']),
    backgroundColor: interpolateColor(
      focus.value,
      [0, 1],
      [palette.glassSunken, 'rgba(255,255,255,0.08)'],
    ),
  }));

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.wrap, wrapStyle]}>
        {icon ? <Ionicons name={icon} size={17} color={palette.textFaint} /> : null}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.textFaint}
          style={styles.input}
          secureTextEntry={hidden}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          autoComplete={autoComplete}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={onFocus}
          onBlur={onBlur}
          selectionColor={palette.violet}
        />
        {secure ? (
          <Ionicons
            name={hidden ? 'eye-outline' : 'eye-off-outline'}
            size={18}
            color={palette.textFaint}
            onPress={() => setHidden((h) => !h)}
            suppressHighlighting
          />
        ) : null}
      </Animated.View>
      {error ? <ErrorText text={error} /> : null}
    </View>
  );
});

const ErrorText = memo(function ErrorText({ text }: { text: string }) {
  return (
    <View style={styles.errorRow}>
      <Ionicons name="alert-circle" size={13} color={palette.rose} />
      <Text style={styles.errorText}>{text}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  group: {
    gap: 7,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.textMuted,
    marginLeft: 2,
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
    padding: 0,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 2,
  },
  errorText: {
    fontSize: 12,
    color: palette.rose,
    fontWeight: '600',
    flex: 1,
  },
});
