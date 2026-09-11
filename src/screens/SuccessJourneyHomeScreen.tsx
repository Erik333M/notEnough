import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CalendarStrip } from '../features/journey/CalendarStrip';
import { HabitsTodayCard } from '../features/journey/HabitsTodayCard';
import { IntentionCard } from '../features/journey/IntentionCard';
import { OverTimeSection } from '../features/journey/OverTimeSection';
import { PlusOneCard } from '../features/journey/PlusOneCard';
import { TodayExtrasSection } from '../features/journey/TodayExtrasSection';
import { dayKey, weekdayDateLabel } from '../lib/time';
import { useActions, useAppState } from '../state/DataContext';
import { allBenchmarks, resultCount } from '../state/journey/benchmarks';
import { dayStrip, entryFor, entryStreak, totalDaysLogged } from '../state/journey/entries';
import { activeHabits } from '../state/journey/habits';
import { sortedMeasurements } from '../state/journey/measurements';
import type { IntentionSlot } from '../state/journey/entryReducer';
import type { DayKey, PlusOneKey } from '../state/journey/types';
import { palette, radius } from '../theme/theme';
import { Appear, Pill } from '../ui/Controls';
import { SkeletonCard } from '../ui/Feedback';
import { GlassCard } from '../ui/Glass';

/**
 * Home is today.
 *
 * Opening the feature lands on the current day's page, never on a menu or a
 * dashboard of empty charts. Day one shows three things and nothing else:
 * today's decision, today's habit, and Plus One. Everything wordier lives
 * behind one clearly-labelled link, so the first screen is never a wall of
 * empty inputs.
 */
export default function SuccessJourneyHomeScreen({
  bottomInset,
  onOpenEntry,
  onOpenWod,
  onOpenBenchmarks,
  onOpenMeasurements,
  onOpenHabits,
  onOpenProgress,
}: {
  bottomInset: number;
  onOpenEntry: (date: DayKey) => void;
  onOpenWod: (date: DayKey) => void;
  onOpenBenchmarks: () => void;
  onOpenMeasurements: () => void;
  onOpenHabits: () => void;
  onOpenProgress: () => void;
}) {
  const state = useAppState();
  const { journey } = useActions();

  const journeyState = state?.journey;

  const view = useMemo(() => {
    if (!journeyState) return null;
    const today = dayKey();
    return {
      today,
      journey: journeyState,
      entry: entryFor(journeyState, today),
      strip: dayStrip(journeyState, 14),
      streak: entryStreak(journeyState),
      logged: totalDaysLogged(journeyState),
      benchmarksTested: allBenchmarks(journeyState).filter(
        (b) => resultCount(journeyState, b.id) > 0,
      ).length,
      readings: sortedMeasurements(journeyState).length,
      habits: activeHabits(journeyState),
      checks: journeyState.checks,
    };
  }, [journeyState]);

  /*
   * Every handler resolves the date at dispatch time rather than closing over
   * the render-time value, so a session left open past midnight writes to the
   * day it is now — the same rule the victories toggle already follows.
   */
  const handleIntentionText = useCallback(
    (slot: IntentionSlot, text: string) => journey.setIntentionText(dayKey(), slot, text),
    [journey],
  );

  const handleIntentionDone = useCallback(
    (slot: IntentionSlot, current: boolean | null) =>
      journey.cycleIntentionDone(dayKey(), slot, current),
    [journey],
  );

  const handlePlusOne = useCallback(
    (key: PlusOneKey) => journey.togglePlusOne(dayKey(), key),
    [journey],
  );

  const handleOpenToday = useCallback(() => onOpenEntry(dayKey()), [onOpenEntry]);

  const handleHabitCheck = useCallback(
    (id: string) => journey.toggleHabitCheck(dayKey(), id),
    [journey],
  );

  if (!view) {
    return (
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <SkeletonCard />
        <SkeletonCard delay={120} />
        <SkeletonCard delay={240} />
      </ScrollView>
    );
  }

  const { entry, strip, streak, logged, benchmarksTested, readings, habits, checks } = view;
  const firstTime = logged === 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews
    >
      <Appear>
        <GlassCard style={styles.hero} elevated>
          <View style={styles.heroTop}>
            <View style={styles.heroText}>
              <Pill label={weekdayDateLabel()} icon="today-outline" accent="violet" />
              <Text style={styles.heroTitle}>
                {firstTime ? 'Start wherever you like.' : 'Today’s page.'}
              </Text>
              <Text style={styles.heroCopy}>
                {firstTime
                  ? 'Nothing here is required. One box is a finished day.'
                  : `${logged} ${logged === 1 ? 'day' : 'days'} written${
                      streak > 1 ? ` • ${streak} in a row` : ''
                    }`}
              </Text>
            </View>
          </View>

          <CalendarStrip days={strip} onSelect={onOpenEntry} />
        </GlassCard>
      </Appear>

      <Appear delay={60}>
        <IntentionCard
          slot="decision"
          title="DECISION"
          intention={entry.decision}
          accent="amber"
          onChangeText={handleIntentionText}
          onCycleDone={handleIntentionDone}
        />
      </Appear>

      <Appear delay={110}>
        <IntentionCard
          slot="habit"
          title="HABIT"
          intention={entry.habit}
          accent="lime"
          onChangeText={handleIntentionText}
          onCycleDone={handleIntentionDone}
        />
      </Appear>

      <Appear delay={160}>
        <PlusOneCard plusOne={entry.plusOne} onToggle={handlePlusOne} />
      </Appear>

      {habits.length > 0 ? (
        <Appear delay={190}>
          <HabitsTodayCard
            habits={habits}
            checks={checks}
            today={view.today}
            onToggle={handleHabitCheck}
            onOpenAll={onOpenHabits}
          />
        </Appear>
      ) : null}

      <TodayExtrasSection
        date={view.today}
        wod={entry.wod}
        journey={view.journey}
        firstTime={firstTime}
        onOpenWod={onOpenWod}
        onOpenEntry={handleOpenToday}
      />

      <OverTimeSection
        daysWritten={logged}
        habitCount={habits.length}
        benchmarksTested={benchmarksTested}
        readings={readings}
        onOpenHabits={onOpenHabits}
        onOpenBenchmarks={onOpenBenchmarks}
        onOpenMeasurements={onOpenMeasurements}
        onOpenProgress={onOpenProgress}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  hero: {
    gap: 14,
    borderRadius: radius.lg,
  },
  heroTop: {
    flexDirection: 'row',
  },
  heroText: {
    flex: 1,
    gap: 6,
    alignItems: 'flex-start',
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: palette.text,
  },
  heroCopy: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: palette.textMuted,
  },
});
