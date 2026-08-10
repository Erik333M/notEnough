import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GoalCard } from '../features/goals/GoalCard';
import { dayKey } from '../lib/time';
import type { RouteKey } from '../navigation/routes';
import { useActions, useAppState, useStats } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { projectPlan } from '../state/selectors';
import { accentColor, palette, radius } from '../theme/theme';
import { Appear, Pill, SectionHeader, StatTile } from '../ui/Controls';
import { EmptyState, SkeletonCard } from '../ui/Feedback';
import { GlassCard } from '../ui/Glass';
import { ProgressRing } from '../ui/Progress';
import { PressableScale } from '../ui/Touchable';

export default function HomeScreen({
  bottomInset,
  navigate,
}: {
  bottomInset: number;
  navigate: (key: RouteKey) => void;
}) {
  const state = useAppState();
  const stats = useStats();
  const { addProgress, completeGoal } = useActions();
  const { user } = useAuth();

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
  const openGoals = useCallback(() => navigate('goals'), [navigate]);

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
  const percent = Math.round(todayCompletion * 100);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
    >
      <Appear>
        <GlassCard style={styles.hero} elevated>
          <View style={styles.heroTop}>
            <View style={{ flex: 1, gap: 6 }}>
              <Pill label={greeting()} icon="sunny-outline" accent="amber" />
              <Text style={styles.heroTitle} numberOfLines={2}>
                {firstName(user?.name)}, today is {percent >= 100 ? 'closed out' : 'still open'}.
              </Text>
              <Text style={styles.heroCopy}>
                {closed} of {goals.length} goals complete • {streak} day streak
              </Text>
            </View>

            <ProgressRing progress={todayCompletion} size={96} accent="violet">
              <Text style={styles.ringValue}>{percent}%</Text>
              <Text style={styles.ringLabel}>today</Text>
            </ProgressRing>
          </View>

          <View style={styles.statRow}>
            <StatTile value={`${closed}`} label="Closed" accent="lime" />
            <StatTile value={`${goals.length - closed}`} label="Open" />
            <StatTile value={`${streak}d`} label="Streak" accent="amber" />
          </View>
        </GlassCard>
      </Appear>

      <Appear delay={60}>
        <View style={styles.quickRow}>
          <QuickAction
            icon="stopwatch"
            title="Start a run"
            copy="Stopwatch & intervals"
            accent="cyan"
            onPress={() => navigate('timer')}
          />
          <QuickAction
            icon="add-circle"
            title="New goal"
            copy="Set a daily target"
            accent="violet"
            onPress={() => navigate('goals')}
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
    </ScrollView>
  );
}

const QuickAction = memo(function QuickAction({
  icon,
  title,
  copy,
  accent,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  copy: string;
  accent: 'cyan' | 'violet';
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} haptic="medium" scaleTo={0.96} style={{ flex: 1 }}>
      <GlassCard style={styles.quickCard}>
        <Ionicons name={icon} size={22} color={accentColor[accent]} />
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickCopy}>{copy}</Text>
      </GlassCard>
    </PressableScale>
  );
});

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function firstName(name: string | undefined): string {
  if (!name) return 'Athlete';
  return name.trim().split(/\s+/)[0];
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  hero: {
    gap: 16,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: palette.text,
  },
  heroCopy: {
    fontSize: 12,
    color: palette.textFaint,
    fontWeight: '600',
  },
  ringValue: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  ringLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.textFaint,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickCard: {
    gap: 6,
    minHeight: 108,
    justifyContent: 'center',
  },
  quickTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
  },
  quickCopy: {
    fontSize: 11,
    color: palette.textFaint,
    fontWeight: '600',
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
