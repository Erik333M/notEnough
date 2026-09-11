import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import type { HabitDay } from '../../state/journey/habits';
import type { Habit } from '../../state/journey/types';
import { accentColor, motion, palette, radius } from '../../theme/theme';
import { PressableScale } from '../../ui/Touchable';

/**
 * One adopted habit: today's tick, its streak, and a fortnight of history.
 *
 * The dot row is the whole point of a habit tracker, and it is also where one
 * can start nagging. Missed days are faint outlines, never red, and the streak
 * line says "start today" rather than "0 days" — a zero reads as a score you
 * are losing, which is exactly the guilt this feature is meant to avoid.
 */
type Props = {
  habit: Habit;
  done: boolean;
  streak: number;
  history: HabitDay[];
  onToggle: (id: string) => void;
  onEdit?: (habit: Habit) => void;
};

function streakLabel(streak: number, done: boolean): string {
  if (streak > 1) return `${streak} days running`;
  if (streak === 1) return done ? 'Started today' : 'One day so far';
  return 'Start whenever';
}

export const HabitRow = memo(function HabitRow({
  habit,
  done,
  streak,
  history,
  onToggle,
  onEdit,
}: Props) {
  const t = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    t.value = withSpring(done ? 1 : 0, motion.spring);
  }, [done, t]);

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      t.value,
      [0, 1],
      [palette.glassSunken, accentColor.lime],
    ),
    borderColor: interpolateColor(t.value, [0, 1], [palette.hairlineStrong, accentColor.lime]),
  }));

  const tickStyle = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ scale: 0.4 + t.value * 0.6 }],
  }));

  const handleToggle = useCallback(() => onToggle(habit.id), [habit.id, onToggle]);
  const handleEdit = useCallback(() => onEdit?.(habit), [habit, onEdit]);

  return (
    <PressableScale
      onPress={handleToggle}
      haptic={done ? 'light' : 'medium'}
      scaleTo={0.98}
      // Holds its own edit button, so the row itself must not be a button too.
      accessibilityRole={onEdit ? 'none' : 'switch'}
      accessibilityLabel={`${habit.title}. ${
        done ? 'Done today' : 'Not done today'
      }. ${streakLabel(streak, done)}.`}
      style={styles.row}
    >
      <Animated.View style={[styles.box, boxStyle]}>
        <Animated.View style={tickStyle}>
          <Ionicons name="checkmark-sharp" size={16} color={palette.onAccent} />
        </Animated.View>
      </Animated.View>

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {habit.title}
        </Text>
        <View style={styles.dots}>
          {history.map((day) => (
            <View
              key={day.key}
              style={[
                styles.dot,
                // Before the habit existed: shown so the row keeps its shape,
                // faint enough that it cannot read as a missed day.
                !day.tracked && styles.dotUntracked,
                day.done && styles.dotDone,
              ]}
            />
          ))}
          <Text style={styles.streak} numberOfLines={1}>
            {streakLabel(streak, done)}
          </Text>
        </View>
      </View>

      {onEdit ? (
        <PressableScale
          onPress={handleEdit}
          haptic="selection"
          scaleTo={0.86}
          hitSlop={10}
          accessibilityLabel={`Edit ${habit.title}`}
          style={styles.edit}
        >
          <Ionicons name="options-outline" size={15} color={palette.textFaint} />
        </PressableScale>
      ) : null}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
  },
  box: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  text: {
    flex: 1,
    gap: 5,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  dotUntracked: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  dotDone: {
    backgroundColor: accentColor.lime,
  },
  streak: {
    flex: 1,
    marginLeft: 6,
    fontSize: 10,
    fontWeight: '700',
    color: palette.textFaint,
  },
  edit: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
});
