import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { VictoryGoalDef } from '../../state/victories';
import { accentColor, motion, palette, radius, type AccentName } from '../../theme/theme';
import { PressableScale } from '../../ui/Touchable';

type Props = {
  goal: VictoryGoalDef;
  target: string;
  done: boolean;
  accent: AccentName;
  onToggle: (goal: VictoryGoalDef['key']) => void;
  onEditTarget: (goal: VictoryGoalDef['key']) => void;
};

/**
 * One of the nine daily goals.
 *
 * Memoised so toggling one goal repaints one row rather than the whole
 * dashboard, and the check animation is driven entirely by shared values — the
 * tick lands on the UI thread even while the reducer, disk write and sync push
 * are still working through the same tap on the JS thread.
 */
export const VictoryGoalItem = memo(function VictoryGoalItem({
  goal,
  target,
  done,
  accent,
  onToggle,
  onEditTarget,
}: Props) {
  const t = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    t.value = withSpring(done ? 1 : 0, motion.spring);
  }, [done, t]);

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      t.value,
      [0, 1],
      [palette.glassSunken, accentColor[accent]],
    ),
    borderColor: interpolateColor(
      t.value,
      [0, 1],
      [palette.hairlineStrong, accentColor[accent]],
    ),
  }));

  // The tick overshoots slightly on the way in — the "satisfying" part.
  const tickStyle = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ scale: 0.4 + t.value * 0.6 }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    color: interpolateColor(t.value, [0, 1], [palette.text, accentColor[accent]]),
  }));

  const handleToggle = useCallback(() => onToggle(goal.key), [goal.key, onToggle]);
  const handleEdit = useCallback(() => onEditTarget(goal.key), [goal.key, onEditTarget]);

  return (
    <PressableScale
      onPress={handleToggle}
      onLongPress={handleEdit}
      haptic={done ? 'light' : 'medium'}
      scaleTo={0.98}
      // Holds its own edit button, so the row itself must not be a button too —
      // nesting them is ambiguous for screen readers and invalid HTML on web.
      accessibilityRole="none"
      accessibilityLabel={`${goal.title}, ${target}, ${done ? 'won' : 'not yet'}`}
      style={styles.row}
    >
      <Animated.View style={[styles.box, boxStyle]}>
        <Animated.View style={tickStyle}>
          <Ionicons name="checkmark-sharp" size={16} color={palette.onAccent} />
        </Animated.View>
      </Animated.View>

      <View style={styles.text}>
        <Animated.Text style={[styles.title, titleStyle]} numberOfLines={1}>
          {goal.title}
        </Animated.Text>
        <Text style={styles.target} numberOfLines={1}>
          {target}
        </Text>
      </View>

      <PressableScale
        onPress={handleEdit}
        haptic="selection"
        scaleTo={0.86}
        hitSlop={10}
        accessibilityLabel={`Edit target for ${goal.title}`}
        style={styles.edit}
      >
        <Ionicons name="options-outline" size={15} color={palette.textFaint} />
      </PressableScale>
    </PressableScale>
  );
});

/** Slim variant used to preview a victory's goals without interaction. */
export const VictoryGoalDot = memo(function VictoryGoalDot({
  done,
  accent,
}: {
  done: boolean;
  accent: AccentName;
}) {
  const t = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    t.value = withTiming(done ? 1 : 0, { duration: motion.fast });
  }, [done, t]);

  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      t.value,
      [0, 1],
      ['rgba(255,255,255,0.14)', accentColor[accent]],
    ),
  }));

  return <Animated.View style={[styles.dot, style]} />;
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
  target: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textFaint,
    marginTop: 2,
  },
  edit: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.glassSunken,
  },
  dot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
});
