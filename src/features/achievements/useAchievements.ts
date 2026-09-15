import { useMemo } from 'react';

import { dayKey } from '../../lib/time';
import { formatBenchmarkValue, recentPersonalBests } from '../../state/journey/benchmarks';
import { activeHabits, habitStreak } from '../../state/journey/habits';
import { useAppState, useStats } from '../../state/DataContext';
import { deriveAchievements, type Achievement } from './derive';

/**
 * Your achievements, read out of what the app already knows.
 *
 * Nothing here is recorded — no achievements table, no unlock events, no extra
 * writes when you train. It is a view over your streak, your benchmark history
 * and the work you finished, recomputed when those change. That keeps it
 * honest (it cannot say you did something you did not) and it keeps it private
 * by construction: there is no new store of anything to protect.
 */
export function useAchievements(workDone: number): Achievement[] {
  const state = useAppState();
  const stats = useStats();

  return useMemo(() => {
    if (!state || !stats) return [];

    const journey = state.journey;

    const personalBests = recentPersonalBests(journey, 4).map(({ definition, result }) => ({
      definitionId: definition.id,
      name: definition.name,
      display: formatBenchmarkValue(result.value, definition.metric, journey.units),
      value: result.value,
      date: result.date,
    }));

    // The single longest run going, not one card per habit — five habits at
    // fourteen days each is one thing you are doing well, not five.
    let habitRun: { title: string; days: number; date: string } | null = null;
    for (const habit of activeHabits(journey)) {
      const days = habitStreak(journey.checks, habit.id);
      if (!habitRun || days > habitRun.days) {
        habitRun = { title: habit.title, days, date: dayKey() };
      }
    }

    return deriveAchievements({
      streak: stats.streak,
      today: dayKey(),
      personalBests,
      workDone,
      habitRun,
    });
  }, [state, stats, workDone]);
}
