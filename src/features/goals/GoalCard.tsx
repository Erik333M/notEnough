import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { clockLabel } from '../../lib/time';
import { GOAL_UNIT, type Goal } from '../../state/types';
import { accentColor, accentSoft, palette, radius } from '../../theme/theme';
import { GlassCard } from '../../ui/Glass';
import { ProgressBar } from '../../ui/Progress';
import { PressableScale } from '../../ui/Touchable';

/** How much one tap adds, per goal kind. */
export function stepFor(goal: Goal): number {
  switch (goal.kind) {
    case 'minutes':
      return 5;
    case 'reps':
      return 10;
    case 'distance':
      return 500;
    case 'check':
      return goal.target;
  }
}

export function amountLabel(goal: Goal, amount: number): string {
  if (goal.kind === 'check') return amount >= goal.target ? 'Done' : 'Not yet';
  if (goal.kind === 'distance') {
    return `${(amount / 1000).toFixed(2)} / ${(goal.target / 1000).toFixed(2)} km`;
  }
  return `${amount} / ${goal.target} ${GOAL_UNIT[goal.kind]}`;
}

type Props = {
  goal: Goal;
  amount: number;
  onAdd: (goalId: string, delta: number) => void;
  onComplete: (goalId: string) => void;
  onPress?: (goalId: string) => void;
  delay?: number;
};

/**
 * Memoised on purpose: the Today screen re-renders whenever *any* goal's
 * progress changes, but each card only re-renders when its own amount does.
 */
export const GoalCard = memo(function GoalCard({
  goal,
  amount,
  onAdd,
  onComplete,
  onPress,
  delay = 0,
}: Props) {
  const done = amount >= goal.target;
  const ratio = goal.target > 0 ? Math.min(1, amount / goal.target) : 0;
  const step = stepFor(goal);

  const handleAdd = useCallback(() => onAdd(goal.id, step), [goal.id, onAdd, step]);
  const handleComplete = useCallback(() => onComplete(goal.id), [goal.id, onComplete]);
  const handlePress = useCallback(() => onPress?.(goal.id), [goal.id, onPress]);

  return (
    <Animated.View layout={LinearTransition.springify().damping(20)}>
      <PressableScale onPress={onPress ? handlePress : undefined} haptic="light" scaleTo={0.985}>
        <GlassCard style={styles.card} tone={done ? 'strong' : 'default'}>
          <View style={styles.top}>
            <View style={[styles.icon, { backgroundColor: accentSoft[goal.accent] }]}>
              <Ionicons name={goal.icon} size={18} color={accentColor[goal.accent]} />
            </View>

            <View style={styles.titles}>
              <Text style={styles.title} numberOfLines={1}>
                {goal.title}
              </Text>
              <Text style={styles.detail} numberOfLines={1}>
                {goal.detail}
              </Text>
            </View>

            <PressableScale
              onPress={handleComplete}
              haptic="medium"
              scaleTo={0.88}
              style={[
                styles.check,
                done && { backgroundColor: accentColor[goal.accent], borderColor: 'transparent' },
              ]}
            >
              <Ionicons
                name="checkmark"
                size={17}
                color={done ? palette.onAccent : palette.textFaint}
              />
            </PressableScale>
          </View>

          <ProgressBar progress={ratio} accent={goal.accent} delay={delay} />

          <View style={styles.bottom}>
            <Text style={[styles.amount, done && { color: accentColor[goal.accent] }]}>
              {amountLabel(goal, amount)}
            </Text>

            <View style={styles.actions}>
              {goal.reminder.enabled ? (
                <View style={styles.reminderTag}>
                  <Ionicons name="notifications" size={11} color={palette.textMuted} />
                  <Text style={styles.reminderText}>
                    {clockLabel(goal.reminder.hour, goal.reminder.minute)}
                  </Text>
                </View>
              ) : null}

              {goal.kind === 'check' ? null : (
                <PressableScale onPress={handleAdd} haptic="light" scaleTo={0.9}>
                  <View style={styles.addButton}>
                    <Ionicons name="add" size={14} color={palette.text} />
                    <Text style={styles.addText}>
                      {goal.kind === 'distance' ? `${step}m` : `${step}`}
                    </Text>
                  </View>
                </PressableScale>
              )}
            </View>
          </View>
        </GlassCard>
      </PressableScale>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
  },
  detail: {
    fontSize: 12,
    color: palette.textFaint,
    marginTop: 2,
  },
  check: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairlineStrong,
    backgroundColor: palette.glassSunken,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  amount: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: palette.textMuted,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: palette.glassSunken,
  },
  reminderText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textMuted,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: palette.glassStrong,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairlineStrong,
  },
  addText: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.text,
  },
});
