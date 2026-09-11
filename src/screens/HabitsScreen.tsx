import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { HabitEditSheet } from '../features/journey/HabitEditSheet';
import { HabitRow } from '../features/journey/HabitRow';
import { HabitTemplateSheet } from '../features/journey/HabitTemplateSheet';
import { JourneyHeaderBar } from '../features/journey/JourneyHeaderBar';
import { dayKey } from '../lib/time';
import { useActions, useAppState } from '../state/DataContext';
import {
  activeHabits,
  availableTemplates,
  checkedCount,
  habitConsistency,
  habitHistory,
  habitStreak,
  isChecked,
} from '../state/journey/habits';
import type { Habit, HabitGroup, HabitTemplate } from '../state/journey/types';
import { palette, radius } from '../theme/theme';
import { Button } from '../ui/Button';
import { Appear, StatTile } from '../ui/Controls';
import { EmptyState } from '../ui/Feedback';
import { GlassCard } from '../ui/Glass';
import { useToast } from '../ui/Toast';

/**
 * Standing habits: today's ticks, each one's streak, and the template browser.
 *
 * Distinct from the daily entry's single "I will…" habit line, which is that
 * day's intention. These are the ones you are trying to repeat indefinitely,
 * and the daily line can be filled from them in one tap.
 */
export default function HabitsScreen({
  bottomInset,
  onBack,
}: {
  bottomInset: number;
  onBack: () => void;
}) {
  const state = useAppState();
  const { journey } = useActions();
  const { notify } = useToast();

  const [browsing, setBrowsing] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);

  const journeyState = state?.journey;

  const view = useMemo(() => {
    if (!journeyState) return null;
    const today = dayKey();
    const habits = activeHabits(journeyState);

    return {
      today,
      habits,
      // Each row carries its own numbers, so the list renders in one pass.
      rows: habits.map((habit) => ({
        habit,
        done: isChecked(journeyState.checks, today, habit.id),
        streak: habitStreak(journeyState.checks, habit.id),
        history: habitHistory(journeyState.checks, habit, 14),
      })),
      doneToday: checkedCount(journeyState.checks, today, habits),
      consistency: habitConsistency(journeyState, 30),
      templates: availableTemplates(journeyState),
    };
  }, [journeyState]);

  const handleToggle = useCallback(
    // Resolved at tap time, so a session left open past midnight ticks today.
    (id: string) => journey.toggleHabitCheck(dayKey(), id),
    [journey],
  );

  const handleAdopt = useCallback(
    (template: HabitTemplate) => {
      journey.adoptTemplate(template);
      setBrowsing(false);
      notify(`${template.title} added.`, 'success');
    },
    [journey, notify],
  );

  const handleCreate = useCallback(
    (title: string, group: HabitGroup) => {
      journey.addHabit(title, group);
      setBrowsing(false);
      notify(`${title} added.`, 'success');
    },
    [journey, notify],
  );

  const handleRename = useCallback(
    (id: string, title: string) => {
      journey.renameHabit(id, title);
      setEditing(null);
      notify('Habit renamed.', 'info');
    },
    [journey, notify],
  );

  const handleArchive = useCallback(
    (id: string) => {
      journey.archiveHabit(id);
      setEditing(null);
      notify('Stopped tracking. Your ticks are still there.', 'info');
    },
    [journey, notify],
  );

  if (!view) {
    return (
      <View style={styles.flex}>
        <JourneyHeaderBar title="Habits" onBack={onBack} backLabel="Back" />
      </View>
    );
  }

  const { rows, doneToday, consistency, templates, habits } = view;

  return (
    <View style={styles.flex}>
      <JourneyHeaderBar
        title="Habits"
        meta={
          habits.length > 0
            ? `${doneToday} of ${habits.length} done today`
            : 'Small things, repeated'
        }
        onBack={onBack}
        backLabel="Back to the journey home"
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
      >
        {habits.length === 0 ? (
          <>
            <Appear>
              <EmptyState
                icon="repeat-outline"
                title="No habits yet"
                copy="Pick one small thing you could do on your worst day, and start there."
              />
            </Appear>
            <Appear delay={60}>
              <Button label="Add your first habit" icon="add" onPress={() => setBrowsing(true)} />
            </Appear>
          </>
        ) : (
          <>
            <Appear>
              <GlassCard style={styles.summary}>
                <View style={styles.statRow}>
                  <StatTile
                    value={`${doneToday}/${habits.length}`}
                    label="Today"
                    accent="lime"
                  />
                  <StatTile
                    value={`${Math.round(consistency * 100)}%`}
                    label="Last 30 days"
                    accent="cyan"
                  />
                  <StatTile value={`${habits.length}`} label="Running" accent="violet" />
                </View>
                <Text style={styles.summaryNote}>
                  Counted only from the day each habit was added.
                </Text>
              </GlassCard>
            </Appear>

            <Appear delay={60}>
              <GlassCard style={styles.list}>
                {rows.map((row) => (
                  <HabitRow
                    key={row.habit.id}
                    habit={row.habit}
                    done={row.done}
                    streak={row.streak}
                    history={row.history}
                    onToggle={handleToggle}
                    onEdit={setEditing}
                  />
                ))}
              </GlassCard>
            </Appear>

            <Appear delay={110}>
              <Button
                label="Add another habit"
                icon="add"
                variant="glass"
                onPress={() => setBrowsing(true)}
              />
            </Appear>
          </>
        )}
      </ScrollView>

      <HabitTemplateSheet
        visible={browsing}
        templates={templates}
        onClose={() => setBrowsing(false)}
        onAdopt={handleAdopt}
        onCreate={handleCreate}
      />

      <HabitEditSheet
        habit={editing}
        onClose={() => setEditing(null)}
        onRename={handleRename}
        onArchive={handleArchive}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  summary: {
    gap: 10,
    borderRadius: radius.lg,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryNote: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textFaint,
    textAlign: 'center',
  },
  list: {
    gap: 2,
    borderRadius: radius.lg,
  },
});
