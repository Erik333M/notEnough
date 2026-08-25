import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { VictoryCard } from '../features/victories/VictoryCard';
import { VictoryProgress } from '../features/victories/VictoryProgress';
import { VictoryTargetEditor } from '../features/victories/VictoryTargetEditor';
import { useActions, useAppState, useStats } from '../state/DataContext';
import type { VictoryGoalKey } from '../state/types';
import {
  TOTAL_VICTORY_GOALS,
  VICTORIES,
  totalDaysWon,
  victorySeries,
} from '../state/victories';
import { palette, radius } from '../theme/theme';
import { Appear, SectionHeader, StatTile } from '../ui/Controls';
import { SkeletonCard } from '../ui/Feedback';
import { GlassCard } from '../ui/Glass';
import { ColumnChart } from '../ui/Progress';
import { useToast } from '../ui/Toast';

/**
 * 3 Victories dashboard.
 *
 * The whole screen reads top to bottom as the hierarchy the feature is built
 * around: BODY → MIND → SPIRIT, and nine goals resolving into one day. Every
 * number on it comes from the shared stats memo in the data layer, so a tap
 * costs one pass over today's record rather than one per card.
 */
export default function VictoriesScreen({ bottomInset }: { bottomInset: number }) {
  const state = useAppState();
  const stats = useStats();
  const { toggleVictoryGoal, setVictoryTarget } = useActions();
  const { notify } = useToast();

  const [editing, setEditing] = useState<VictoryGoalKey | null>(null);

  const log = state?.victories.log;
  const series = useMemo(() => (log ? victorySeries(log, 7) : []), [log]);
  const daysWon = useMemo(() => (log ? totalDaysWon(log) : 0), [log]);

  const score = stats?.victoryScore ?? 0;
  const wonCount = stats?.victoriesWon ?? 0;

  /**
   * Celebrations fire on the *transition* into a win, never on a render. Both
   * counters start unset so hydrating a day that was already won — reopening
   * the app, or adopting a synced copy from another device — stays silent
   * instead of buzzing the phone about something the user did hours ago.
   */
  const lastWon = useRef<number | null>(null);
  const lastScore = useRef<number | null>(null);

  useEffect(() => {
    if (!stats) return;

    const previousWon = lastWon.current;
    const previousScore = lastScore.current;
    lastWon.current = wonCount;
    lastScore.current = score;

    if (previousWon === null || previousScore === null) return;

    if (score === TOTAL_VICTORY_GOALS && previousScore < TOTAL_VICTORY_GOALS) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      notify('3 VICTORIES WON — the day is yours.', 'success');
      return;
    }

    if (wonCount > previousWon) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      notify('Victory won. Two more make the day.', 'success');
    }
  }, [notify, score, stats, wonCount]);

  const handleToggle = useCallback(
    (goal: VictoryGoalKey) => toggleVictoryGoal(goal),
    [toggleVictoryGoal],
  );

  const openEditor = useCallback((goal: VictoryGoalKey) => setEditing(goal), []);
  const closeEditor = useCallback(() => setEditing(null), []);

  const handleSaveTarget = useCallback(
    (goal: VictoryGoalKey, target: string) => {
      setVictoryTarget(goal, target);
      notify('Target updated.', 'info');
    },
    [notify, setVictoryTarget],
  );

  if (!state || !stats) {
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

  const { victoryToday, victoryStreak: streak } = stats;
  const targets = state.victories.targets;

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
      >
        <Appear>
          <GlassCard style={styles.hero}>
            <Text style={styles.heroKicker}>THE STANDARD</Text>
            <Text style={styles.heroLine}>
              9 GOALS <Text style={styles.heroArrow}>→</Text> 3 VICTORIES{' '}
              <Text style={styles.heroArrow}>→</Text> 1 STRONGER DAY
            </Text>
            <Text style={styles.heroCopy}>
              Three goals in each victory. Win all three and the victory is yours; win all nine and
              so is the day.
            </Text>
          </GlassCard>
        </Appear>

        {VICTORIES.map((victory, index) => (
          <Appear key={victory.key} delay={60 + index * 60}>
            <VictoryCard
              victory={victory}
              day={victoryToday}
              targets={targets}
              onToggle={handleToggle}
              onEditTarget={openEditor}
            />
          </Appear>
        ))}

        <Appear delay={260}>
          <VictoryProgress
            day={victoryToday}
            score={score}
            victoriesWon={wonCount}
            streak={streak}
          />
        </Appear>

        <Appear delay={320}>
          <SectionHeader title="Last 7 days" meta="Goals won each day" />
        </Appear>

        <Appear delay={360}>
          <GlassCard style={styles.history}>
            <ColumnChart data={series} accent="violet" height={118} />
            <View style={styles.statRow}>
              <StatTile value={`${streak}d`} label="Perfect streak" accent="lime" />
              <StatTile value={`${daysWon}`} label="Days won" accent="violet" />
              <StatTile value={`${score}/${TOTAL_VICTORY_GOALS}`} label="Today" accent="amber" />
            </View>
          </GlassCard>
        </Appear>
      </ScrollView>

      <VictoryTargetEditor
        goal={editing}
        target={editing ? targets[editing] : ''}
        onClose={closeEditor}
        onSave={handleSaveTarget}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  hero: {
    gap: 8,
    backgroundColor: 'rgba(139,107,255,0.10)',
    borderColor: 'rgba(139,107,255,0.26)',
    borderRadius: radius.lg,
  },
  heroKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: palette.textFaint,
  },
  heroLine: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: palette.text,
  },
  heroArrow: {
    color: palette.violet,
  },
  heroCopy: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: palette.textMuted,
  },
  history: {
    gap: 14,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
