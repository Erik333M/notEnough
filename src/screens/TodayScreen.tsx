import { memo, useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Assignment } from '../api/teams';
import { GoalCard } from '../features/goals/GoalCard';
import { TodayHero } from '../features/goals/TodayHero';
import { QuickAction } from '../features/goals/QuickAction';
import { VictoriesTodayCard } from '../features/victories/VictoriesTodayCard';
import { AssignedWorkCard } from '../features/teams/AssignedWorkCard';
import { FeedSection } from '../features/friends/FeedSection';
import { LogResultSheet } from '../features/teams/LogResultSheet';
import { useMyWork } from '../features/teams/useMyWork';
import { dayKey } from '../lib/time';
import { useActions, useAppState, useStats } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { projectPlan } from '../state/selectors';
import { palette, radius } from '../theme/theme';
import { Appear, Pill, SectionHeader } from '../ui/Controls';
import { EmptyState, SkeletonCard } from '../ui/Feedback';
import { GlassCard } from '../ui/Glass';

/**
 * Today.
 *
 * Work a coach set you sits directly under the hero, above your own goals:
 * it has a deadline someone else is watching, and it is the one thing here
 * you did not choose. For a solo user the card does not render at all — the
 * hook makes no request without a membership, so the screen is unchanged.
 */
export default function TodayScreen({
  bottomInset,
  onOpenGoals,
  onOpenVictories,
  onOpenTimer,
  onOpenFriends,
}: {
  bottomInset: number;
  /** Pushes onto the Home tab's own stack. */
  onOpenGoals: () => void;
  onOpenVictories: () => void;
  /** Switches tab — the timer is a place you go, not a drill-down. */
  onOpenTimer: () => void;
  /** The feed lives here, but Friends itself is a screen under the You tab. */
  onOpenFriends: () => void;
}) {
  const state = useAppState();
  const stats = useStats();
  const { addProgress, completeGoal } = useActions();
  const { user } = useAuth();
  const work = useMyWork();
  const [logging, setLogging] = useState<Assignment | null>(null);

  // Streak / completion come from the shared stats memo in the data layer.
  // Only the plan projection is local to this screen, and it depends on `plan`
  // alone — so logging progress does not recompute it.
  const projection = useMemo(() => (state ? projectPlan(state.plan) : null), [state?.plan]);

  const todayLog = state?.log[stats?.todayKey ?? dayKey()];

  const handleAdd = useCallback(
    (goalId: string, delta: number) => addProgress(goalId, delta),
    [addProgress],
  );

  // Stable identity so the memoised GoalCards are not invalidated every render.
  const openGoals = onOpenGoals;

  if (!state || !stats || !projection) {
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

  const { goals, todayCompletion, todayClosed: closed, streak } = stats;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
    >
      <Appear>
        <TodayHero
          name={user?.name}
          goalCount={goals.length}
          closed={closed}
          streak={streak}
          completion={todayCompletion}
        />
      </Appear>

      {work.overdue.length > 0 || work.today.length > 0 ? (
        <Appear delay={40}>
          <AssignedWorkCard overdue={work.overdue} today={work.today} onOpen={setLogging} />
        </Appear>
      ) : null}

      {/*
        3 Victories used to be a tab. It is the daily spine of the app, so it
        keeps a place on the first screen — as a summary you can act on, with
        the full board one tap away.
      */}
      <Appear delay={50}>
        <VictoriesTodayCard onOpen={onOpenVictories} />
      </Appear>

      <Appear delay={60}>
        <View style={styles.quickRow}>
          <QuickAction
            icon="stopwatch"
            title="Start a run"
            copy="Stopwatch & intervals"
            accent="cyan"
            onPress={onOpenTimer}
          />
          <QuickAction
            icon="add-circle"
            title="New goal"
            copy="Set a daily target"
            accent="violet"
            onPress={onOpenGoals}
          />
        </View>
      </Appear>

      <Appear delay={100}>
        <SectionHeader title="Daily goals" meta={`${goals.length} active`} />
      </Appear>

      {goals.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon="flag-outline"
            title="No goals yet"
            copy="Add your first daily goal and the app will keep score from tomorrow onward."
          />
        </GlassCard>
      ) : (
        goals.map((goal, index) => (
          <Appear key={goal.id} delay={120 + index * 45}>
            <GoalCard
              goal={goal}
              amount={todayLog?.[goal.id] ?? 0}
              onAdd={handleAdd}
              onComplete={completeGoal}
              onPress={openGoals}
              delay={index * 60}
            />
          </Appear>
        ))
      )}

      <Appear delay={220}>
        <GlassCard style={styles.push}>
          <View style={styles.pushTop}>
            <Text style={styles.pushTitle}>NOTenough push</Text>
            <Pill label="Stretch target" icon="trending-up" accent="amber" />
          </View>
          <Text style={styles.pushCopy}>
            Hitting today&apos;s numbers is the floor, not the ceiling. Once this level is stable,
            the next standard is{' '}
            <Text style={styles.pushAccent}>{projection.stretchGoal.toLowerCase()}</Text>.
          </Text>
        </GlassCard>
      </Appear>

      <Appear delay={240}>
        <FeedSection onOpenFriends={onOpenFriends} />
      </Appear>

      <LogResultSheet
        assignment={logging}
        onClose={() => setLogging(null)}
        onSave={async (input) => (logging ? work.log(logging, input) : false)}
      />
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
  },
  push: {
    gap: 10,
    backgroundColor: 'rgba(255,182,92,0.10)',
    borderColor: 'rgba(255,182,92,0.28)',
    borderRadius: radius.lg,
  },
  pushTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pushTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.amber,
  },
  pushCopy: {
    fontSize: 13,
    lineHeight: 20,
    color: palette.textMuted,
  },
  pushAccent: {
    fontWeight: '800',
    color: palette.amber,
  },
});
