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

import { motion, radius } from '../theme/theme';
import type { IconName } from '../state/types';
import type { Theme } from '../theme/tokens';
import { useStyles, useTheme } from '../theme/ThemeContext';

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
  const styles = useStyles(makeStyles);
  const theme = useTheme();
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
      : interpolateColor(focus.value, [0, 1], [theme.border, theme.accent.spirit]),
    backgroundColor: interpolateColor(
      focus.value,
      [0, 1],
      [theme.surfaceSunken, theme.surface],
    ),
  }));

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.wrap, wrapStyle]}>
        {icon ? <Ionicons name={icon} size={17} color={theme.textFaint} /> : null}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textFaint}
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
          selectionColor={theme.accent.spirit}
        />
        {secure ? (
          <Ionicons
            name={hidden ? 'eye-outline' : 'eye-off-outline'}
            size={18}
            color={theme.textFaint}
            onPress={() => setHidden((h) => !h)}
            suppressHighlighting
          />
        ) : null}
      </Animated.View>
      {error ? <ErrorText text={error} /> : null}
    </View>
  );
});

type AreaProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onBlur?: () => void;
  /** Visible rows before it scrolls. */
  minLines?: number;
  maxLength?: number;
  accessibilityHint?: string;
};

/**
 * Multi-line sibling of `Field`.
 *
 * Kept in the same module so both share one focus-ring treatment. It grows to
 * `minLines` and then scrolls internally rather than pushing the form around
 * as the user types, and it deliberately has no `returnKeyType` — Return
 * inserts a newline here, so dismissal is by tapping away or the form's Done.
 */
export const TextArea = memo(function TextArea({
  label,
  value,
  onChangeText,
  placeholder,
  onBlur,
  minLines = 3,
  maxLength,
  accessibilityHint,
}: AreaProps) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const focus = useSharedValue(0);

  const handleFocus = useCallback(() => {
    focus.value = withTiming(1, { duration: motion.fast });
  }, [focus]);

  const handleBlur = useCallback(() => {
    focus.value = withTiming(0, { duration: motion.fast });
    onBlur?.();
  }, [focus, onBlur]);

  const wrapStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focus.value,
      [0, 1],
      [theme.border, theme.accent.spirit],
    ),
    backgroundColor: interpolateColor(
      focus.value,
      [0, 1],
      [theme.surfaceSunken, theme.surface],
    ),
  }));

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.areaWrap, { minHeight: 22 * minLines + 24 }, wrapStyle]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textFaint}
          style={styles.area}
          multiline
          textAlignVertical="top"
          maxLength={maxLength}
          autoCapitalize="sentences"
          onFocus={handleFocus}
          onBlur={handleBlur}
          selectionColor={theme.accent.spirit}
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint}
        />
      </Animated.View>
    </View>
  );
});

const ErrorText = memo(function ErrorText({ text }: { text: string }) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <View style={styles.errorRow}>
      <Ionicons name="alert-circle" size={13} color={theme.error} />
      <Text style={styles.errorText}>{text}</Text>
    </View>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  group: {
    gap: 7,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textMuted,
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
    color: theme.text,
    padding: 0,
  },
  areaWrap: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  area: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: theme.text,
    padding: 0,
    margin: 0,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 2,
  },
  errorText: {
    fontSize: 12,
    color: theme.error,
    fontWeight: '600',
    flex: 1,
  },
});
