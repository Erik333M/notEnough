import { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { IntakePrivacyCard } from '../features/journey/IntakePrivacyCard';
import { JourneyHeaderBar } from '../features/journey/JourneyHeaderBar';
import { useIntake } from '../features/journey/useIntake';
import { longDateLabel } from '../lib/time';
import { useAppState } from '../state/DataContext';
import {
  formatBenchmarkValue,
  recentPersonalBests,
} from '../state/journey/benchmarks';
import { daysLoggedThisMonth, entryStreak, totalDaysLogged } from '../state/journey/entries';
import { activeHabits, habitConsistency } from '../state/journey/habits';
import { accentColor, palette, radius } from '../theme/theme';
import { Appear, StatTile } from '../ui/Controls';
import { EmptyState } from '../ui/Feedback';
import { GlassCard } from '../ui/Glass';
import { useToast } from '../ui/Toast';

/**
 * A light summary of the whole feature.
 *
 * Deliberately not a dashboard: three numbers, a short list of recent records,
 * and nothing that could be read as a grade. There are no targets here and no
 * percentages of a goal, because the feature records what you chose to record
 * and has no opinion about whether it was enough.
 */
export default function JourneyProgressScreen({
  bottomInset,
  onBack,
}: {
  bottomInset: number;
  onBack: () => void;
}) {
  const state = useAppState();
  const { intake, withdraw } = useIntake();
  const { notify } = useToast();

  const journeyState = state?.journey;

  const view = useMemo(() => {
    if (!journeyState) return null;
    return {
      thisMonth: daysLoggedThisMonth(journeyState),
      total: totalDaysLogged(journeyState),
      streak: entryStreak(journeyState),
      habits: activeHabits(journeyState).length,
      consistency: habitConsistency(journeyState, 30),
      records: recentPersonalBests(journeyState, 5),
      units: journeyState.units,
    };
  }, [journeyState]);

  const handleWithdraw = useCallback(() => {
    void withdraw();
    notify('Your answers were deleted from this device.', 'info');
  }, [withdraw, notify]);

  if (!view) {
    return (
      <View style={styles.flex}>
        <JourneyHeaderBar title="Progress" onBack={onBack} backLabel="Back" />
      </View>
    );
  }

  const { thisMonth, total, streak, habits, consistency, records, units } = view;
  const nothingYet = total === 0 && records.length === 0 && habits === 0;

  return (
    <View style={styles.flex}>
      <JourneyHeaderBar
        title="Progress"
        meta={total > 0 ? `${total} ${total === 1 ? 'day' : 'days'} written` : 'A quiet summary'}
        onBack={onBack}
        backLabel="Back to the journey home"
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
      >
        {nothingYet ? (
          <Appear>
            <EmptyState
              icon="leaf-outline"
              title="Nothing to summarise yet"
              copy="Write a day, tick a habit or log a test, and it will start showing up here."
            />
          </Appear>
        ) : (
          <>
            <Appear>
              <GlassCard style={styles.card} elevated>
                <View style={styles.statRow}>
                  <StatTile value={`${thisMonth}`} label="This month" accent="violet" />
                  <StatTile value={`${streak}`} label="Day streak" accent="amber" />
                  <StatTile
                    value={habits > 0 ? `${Math.round(consistency * 100)}%` : '—'}
                    label="Habits kept"
                    accent="lime"
                  />
                </View>
                <Text style={styles.note}>
                  Habit consistency counts only from the day each habit was added.
                </Text>
              </GlassCard>
            </Appear>

            <Appear delay={60}>
              <Text style={styles.sectionLabel}>RECENT RECORDS</Text>
            </Appear>

            <Appear delay={90}>
              {records.length === 0 ? (
                <GlassCard style={styles.card}>
                  <Text style={styles.empty}>
                    No benchmark results yet. Test something once and it becomes a record to
                    beat.
                  </Text>
                </GlassCard>
              ) : (
                <GlassCard style={styles.card}>
                  {records.map(({ definition, result }) => (
                    <View key={definition.id} style={styles.record}>
                      <View style={styles.recordText}>
                        <Text style={styles.recordName} numberOfLines={1}>
                          {definition.name}
                        </Text>
                        <Text style={styles.recordDate}>{longDateLabel(result.date)}</Text>
                      </View>
                      <Text style={styles.recordValue}>
                        {formatBenchmarkValue(result.value, definition.metric, units)}
                      </Text>
                    </View>
                  ))}
                </GlassCard>
              )}
            </Appear>
          </>
        )}

        <Appear delay={140}>
          <IntakePrivacyCard intake={intake} onWithdraw={handleWithdraw} />
        </Appear>
      </ScrollView>
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
  card: {
    gap: 12,
    borderRadius: radius.lg,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  note: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textFaint,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: palette.textMuted,
    paddingTop: 4,
  },
  empty: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: palette.textMuted,
  },
  record: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
  },
  recordText: {
    flex: 1,
  },
  recordName: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
  recordDate: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textFaint,
    marginTop: 1,
  },
  recordValue: {
    fontSize: 15,
    fontWeight: '800',
    color: accentColor.lime,
  },
});
