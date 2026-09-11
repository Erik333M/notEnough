import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Appear, SectionHeader } from '../../ui/Controls';
import { JourneyLinkRow } from './JourneyLinkRow';

/**
 * The longer-horizon modules, gathered under one heading on the home screen.
 *
 * Kept apart from the daily cards on purpose: benchmarks and measurements are
 * not things you fill in every day, and sitting them beside today's decision
 * would make the page read like a checklist you are behind on. The heading
 * says as much.
 */
type Props = {
  daysWritten: number;
  habitCount: number;
  benchmarksTested: number;
  readings: number;
  onOpenHabits: () => void;
  onOpenBenchmarks: () => void;
  onOpenMeasurements: () => void;
  onOpenProgress: () => void;
};

export const OverTimeSection = memo(function OverTimeSection({
  daysWritten,
  habitCount,
  benchmarksTested,
  readings,
  onOpenHabits,
  onOpenBenchmarks,
  onOpenMeasurements,
  onOpenProgress,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Appear delay={290}>
        <SectionHeader title="Keep going" meta="Habits, tests and measurements" />
      </Appear>

      <Appear delay={310}>
        <JourneyLinkRow
          icon="repeat-outline"
          title="Habits"
          meta={
            habitCount > 0
              ? `${habitCount} running`
              : 'One small thing, repeated daily'
          }
          accent="lime"
          onPress={onOpenHabits}
        />
      </Appear>

      <Appear delay={340}>
        <JourneyLinkRow
          icon="stopwatch-outline"
          title="Benchmarks"
          meta={
            benchmarksTested > 0
              ? `${benchmarksTested} tested`
              : 'Test something once, then beat it later'
          }
          accent="cyan"
          onPress={onOpenBenchmarks}
        />
      </Appear>

      <Appear delay={370}>
        <JourneyLinkRow
          icon="pulse-outline"
          title="Measurements"
          meta={
            readings > 0
              ? `${readings} ${readings === 1 ? 'reading' : 'readings'}`
              : 'Weight, or anything else you track'
          }
          accent="rose"
          onPress={onOpenMeasurements}
        />
      </Appear>

      <Appear delay={400}>
        <JourneyLinkRow
          icon="leaf-outline"
          title="Progress"
          meta={
            daysWritten > 0
              ? `${daysWritten} ${daysWritten === 1 ? 'day' : 'days'} written`
              : 'A quiet summary, once there is something to show'
          }
          accent="amber"
          onPress={onOpenProgress}
        />
      </Appear>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
});
