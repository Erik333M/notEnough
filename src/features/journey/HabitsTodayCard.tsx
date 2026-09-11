import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Habit, HabitChecks } from '../../state/journey/types';
import { habitHistory, habitStreak, isChecked } from '../../state/journey/habits';
import { accentColor, palette } from '../../theme/theme';
import { GlassCard } from '../../ui/Glass';
import { PressableScale } from '../../ui/Touchable';
import { HabitRow } from './HabitRow';

/**
 * Today's habits, tickable without leaving home.
 *
 * Appears only once at least one habit has been adopted — it is user-created
 * content rather than another empty prompt, which is why it does not count
 * against the three cards a first-time user sees.
 *
 * Caps at four rows: someone running nine habits should not have the rest of
 * the page pushed off screen by a list that has its own dedicated place.
 */
const MAX_ROWS = 4;

type Props = {
  habits: Habit[];
  checks: HabitChecks;
  today: string;
  onToggle: (id: string) => void;
  onOpenAll: () => void;
};

export const HabitsTodayCard = memo(function HabitsTodayCard({
  habits,
  checks,
  today,
  onToggle,
  onOpenAll,
}: Props) {
  const shown = habits.slice(0, MAX_ROWS);
  const overflow = habits.length - shown.length;
  const done = habits.filter((h) => isChecked(checks, today, h.id)).length;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>HABITS</Text>
        <Text style={styles.count}>
          {done} of {habits.length}
        </Text>
      </View>

      <View style={styles.list}>
        {shown.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            done={isChecked(checks, today, habit.id)}
            streak={habitStreak(checks, habit.id)}
            history={habitHistory(checks, habit, 14)}
            onToggle={onToggle}
          />
        ))}
      </View>

      <PressableScale
        onPress={onOpenAll}
        haptic="light"
        scaleTo={0.98}
        accessibilityLabel={
          overflow > 0 ? `See all ${habits.length} habits` : 'Manage your habits'
        }
        style={styles.more}
      >
        <Text style={styles.moreText}>
          {overflow > 0 ? `${overflow} more` : 'Manage habits'}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={palette.textFaint} />
      </PressableScale>
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: accentColor.lime,
  },
  count: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textFaint,
  },
  list: {
    gap: 2,
  },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 40,
  },
  moreText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.textFaint,
  },
});
