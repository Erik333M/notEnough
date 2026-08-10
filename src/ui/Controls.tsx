import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { memo, useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { accentColor, accentSoft, motion, palette, radius, type AccentName } from '../theme/theme';
import type { IconName } from '../state/types';
import { PressableScale } from './Touchable';

/* ------------------------------------------------------------------ header */

export const SectionHeader = memo(function SectionHeader({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
      </View>
      {action}
    </View>
  );
});

/* -------------------------------------------------------------------- pill */

export const Pill = memo(function Pill({
  label,
  icon,
  accent = 'violet',
}: {
  label: string;
  icon?: IconName;
  accent?: AccentName;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: accentSoft[accent] }]}>
      {icon ? <Ionicons name={icon} size={13} color={accentColor[accent]} /> : null}
      <Text style={[styles.pillText, { color: accentColor[accent] }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

/* -------------------------------------------------------------------- chip */

export const Chip = memo(function Chip({
  label,
  active,
  onPress,
  accent = 'violet',
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accent?: AccentName;
}) {
  return (
    <PressableScale onPress={onPress} haptic="selection" scaleTo={0.94} style={styles.chipWrap}>
      <View
        style={[
          styles.chip,
          active && { backgroundColor: accentColor[accent], borderColor: accentColor[accent] },
        ]}
      >
        <Text style={[styles.chipText, active && { color: palette.onAccent }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
});

/* -------------------------------------------------------- segmented control */

/** Generic on purpose (not wrapped in `memo`, which would erase the type param). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const pos = useSharedValue(index);

  useEffect(() => {
    pos.value = withSpring(index, motion.spring);
  }, [index, pos]);

  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);

  const segmentWidth = width > 0 ? (width - 8) / options.length : 0;

  const indicator = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: pos.value * segmentWidth }],
  }));

  return (
    <View style={styles.segmented} onLayout={onLayout}>
      {segmentWidth > 0 ? <Animated.View style={[styles.segmentIndicator, indicator]} /> : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <PressableScale
            key={option.value}
            haptic="selection"
            scaleTo={0.97}
            style={styles.segment}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ toggle */

export const Toggle = memo(function Toggle({
  value,
  onChange,
  accent = 'lime',
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  accent?: AccentName;
}) {
  const t = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    t.value = withSpring(value ? 1 : 0, motion.spring);
  }, [value, t]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      t.value,
      [0, 1],
      ['rgba(255,255,255,0.14)', accentColor[accent]],
    ),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: t.value * 22 }],
  }));

  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onChange(!value);
  }, [onChange, value]);

  return (
    <PressableScale
      onPress={handlePress}
      haptic="none"
      scaleTo={0.92}
      accessibilityRole="switch"
      style={styles.toggleHit}
    >
      <Animated.View style={[styles.toggleTrack, trackStyle]}>
        <Animated.View style={[styles.toggleKnob, knobStyle]} />
      </Animated.View>
    </PressableScale>
  );
});

/* ----------------------------------------------------------------- stepper */

export const Stepper = memo(function Stepper({
  label,
  value,
  display,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  display: string;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <View style={styles.stepper}>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepperLabel}>{label}</Text>
        <Text style={styles.stepperValue}>{display}</Text>
      </View>
      <View style={styles.stepperControls}>
        <RoundIconButton
          icon="remove"
          disabled={value <= min}
          onPress={() => onChange(Math.max(min, value - step))}
        />
        <RoundIconButton
          icon="add"
          disabled={value >= max}
          onPress={() => onChange(Math.min(max, value + step))}
        />
      </View>
    </View>
  );
});

export const RoundIconButton = memo(function RoundIconButton({
  icon,
  onPress,
  disabled,
  size = 40,
  accent,
}: {
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  accent?: AccentName;
}) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} scaleTo={0.9} haptic="light">
      <View
        style={[
          styles.roundButton,
          { width: size, height: size, borderRadius: size / 2 },
          accent && { backgroundColor: accentSoft[accent], borderColor: accentColor[accent] },
        ]}
      >
        <Ionicons
          name={icon}
          size={size * 0.45}
          color={accent ? accentColor[accent] : palette.text}
        />
      </View>
    </PressableScale>
  );
});

/* ----------------------------------------------------------------- stat tile */

export const StatTile = memo(function StatTile({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: AccentName;
}) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, accent && { color: accentColor[accent] }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

/* --------------------------------------------------------------- fade wrap */

/** Simple mount fade+rise; used where layout animations would be overkill. */
export const Appear = memo(function Appear({
  children,
  delay = 0,
  distance = 14,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: object;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(1, { duration: motion.base });
  }, [t]);

  const animated = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * distance }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
});

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
  },
  sectionMeta: {
    fontSize: 12,
    color: palette.textFaint,
    marginTop: 2,
    fontWeight: '600',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  chipWrap: {
    flexGrow: 1,
  },
  chip: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.glass,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.textMuted,
  },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: palette.glassSunken,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
  },
  segmentIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: radius.sm,
    backgroundColor: palette.glassStrong,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairlineStrong,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.textFaint,
  },
  segmentTextActive: {
    color: palette.text,
  },
  toggleHit: {
    padding: 4,
  },
  toggleTrack: {
    width: 50,
    height: 28,
    borderRadius: radius.pill,
    padding: 3,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: palette.glassSunken,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
  },
  stepperLabel: {
    fontSize: 12,
    color: palette.textFaint,
    fontWeight: '700',
  },
  stepperValue: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    marginTop: 2,
  },
  stepperControls: {
    flexDirection: 'row',
    gap: 10,
  },
  roundButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.glassStrong,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairlineStrong,
  },
  statTile: {
    flex: 1,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.glassSunken,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
    gap: 3,
  },
  statValue: {
    fontSize: 19,
    fontWeight: '800',
    color: palette.text,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textFaint,
  },
});
