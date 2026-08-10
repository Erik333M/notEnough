import { memo, useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatMinutes } from '../lib/time';
import { useActions, useAppState } from '../state/DataContext';
import { projectPlan } from '../state/selectors';
import type { GoalLevel, SkillLevel } from '../state/types';
import { palette, radius } from '../theme/theme';
import { Appear, Chip, Pill, SectionHeader, StatTile, Stepper } from '../ui/Controls';
import { SkeletonCard } from '../ui/Feedback';
import { GlassCard } from '../ui/Glass';
import { ProgressRing } from '../ui/Progress';
import { PressableScale } from '../ui/Touchable';

const LEVELS: SkillLevel[] = ['Starter', 'Developing', 'Advanced'];
const GOALS: GoalLevel[] = [
  'Reliable match control',
  'Press-resistant control',
  'Elite first touch',
];

const GOAL_COPY: Record<GoalLevel, string> = {
  'Reliable match control': 'Consistent first touch and cleaner movement in small spaces.',
  'Press-resistant control': 'Receive, protect, and escape pressure with composure.',
  'Elite first touch': 'Top-speed command, clean touch angles, and elite tempo.',
};

const PLAN_BLOCKS = [
  { title: 'Ball familiarity', minutes: 15, focus: 'Toe taps, inside-outside touches, sole rolls' },
  { title: 'Tight-space control', minutes: 20, focus: 'Cone dribbles, pull-push exits, turns under pressure' },
  { title: 'Pressure receiving', minutes: 15, focus: 'Open body shape, first-touch angles, escape routes' },
  { title: 'Explosive finish', minutes: 10, focus: 'Weak-foot work and five-second burst repeats' },
];

const WEEK = [
  { day: 'Mon', title: 'Close control', duration: '60 min', energy: 'Medium' },
  { day: 'Tue', title: 'Recovery + clips', duration: '25 min', energy: 'Low' },
  { day: 'Wed', title: 'Pressure dribbling', duration: '60 min', energy: 'High' },
  { day: 'Thu', title: 'Reaction touches', duration: '45 min', energy: 'Medium' },
  { day: 'Fri', title: 'Small-space mastery', duration: '60 min', energy: 'High' },
  { day: 'Sat', title: 'Match simulation', duration: '75 min', energy: 'High' },
  { day: 'Sun', title: 'Mobility reset', duration: '20 min', energy: 'Low' },
];

export default function PlanScreen({ bottomInset }: { bottomInset: number }) {
  const state = useAppState();
  const { updatePlan } = useActions();

  const projection = useMemo(() => (state ? projectPlan(state.plan) : null), [state]);
  const dailyMinutes = useMemo(() => PLAN_BLOCKS.reduce((sum, b) => sum + b.minutes, 0), []);

  const setLevel = useCallback(
    (value: SkillLevel) => updatePlan({ currentState: value }),
    [updatePlan],
  );
  const setGoal = useCallback((value: GoalLevel) => updatePlan({ goal: value }), [updatePlan]);

  if (!state || !projection) {
    return (
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
        <SkeletonCard />
        <SkeletonCard delay={140} />
      </ScrollView>
    );
  }

  const { plan } = state;

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
              <Pill label="Projected path" icon="sparkles" accent="violet" />
              <Text style={styles.heroTitle}>{projection.weeks} weeks</Text>
              <Text style={styles.heroCopy}>{projection.readiness} • {projection.totalHours}h total</Text>
            </View>
            <ProgressRing progress={projection.completionRate / 100} size={92} accent="violet">
              <Text style={styles.ringValue}>{projection.completionRate}%</Text>
              <Text style={styles.ringLabel}>fit</Text>
            </ProgressRing>
          </View>

          <View style={styles.statRow}>
            <StatTile value={`${plan.hoursPerDay}h`} label="Daily" />
            <StatTile value={`${plan.daysPerWeek}x`} label="Weekly" />
            <StatTile value={formatMinutes(dailyMinutes)} label="Session" accent="cyan" />
          </View>
        </GlassCard>
      </Appear>

      <Appear delay={60}>
        <GlassCard style={styles.stack}>
          <SectionHeader title="Build your path" meta="Planner" />

          <View style={styles.group}>
            <Text style={styles.groupLabel}>Current state</Text>
            <View style={styles.chipRow}>
              {LEVELS.map((level) => (
                <Chip
                  key={level}
                  label={level}
                  active={plan.currentState === level}
                  onPress={() => setLevel(level)}
                />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <Text style={styles.groupLabel}>Target goal</Text>
            <View style={{ gap: 10 }}>
              {GOALS.map((goal) => (
                <GoalOption
                  key={goal}
                  goal={goal}
                  active={plan.goal === goal}
                  onPress={setGoal}
                />
              ))}
            </View>
          </View>

          <Stepper
            label="Hours available each day"
            value={plan.hoursPerDay}
            display={`${plan.hoursPerDay} hour${plan.hoursPerDay === 1 ? '' : 's'}`}
            min={1}
            max={4}
            onChange={(value) => updatePlan({ hoursPerDay: value })}
          />

          <Stepper
            label="Training days per week"
            value={plan.daysPerWeek}
            display={`${plan.daysPerWeek} days`}
            min={3}
            max={7}
            onChange={(value) => updatePlan({ daysPerWeek: value })}
          />
        </GlassCard>
      </Appear>

      <Appear delay={100}>
        <GlassCard style={styles.stretch}>
          <Text style={styles.stretchTitle}>Next standard</Text>
          <Text style={styles.stretchCopy}>
            This target is realistic at your current load. Once it holds up under pressure, the bar
            moves to <Text style={styles.stretchAccent}>{projection.stretchGoal}</Text>.
          </Text>
        </GlassCard>
      </Appear>

      <Appear delay={140}>
        <GlassCard style={styles.stack}>
          <SectionHeader title="Today's session" meta={formatMinutes(dailyMinutes)} />
          {PLAN_BLOCKS.map((block, index) => (
            <View key={block.title} style={styles.blockRow}>
              <View style={styles.blockStep}>
                <Text style={styles.blockStepText}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.blockHeader}>
                  <Text style={styles.blockTitle}>{block.title}</Text>
                  <Text style={styles.blockMinutes}>{block.minutes} min</Text>
                </View>
                <Text style={styles.blockFocus}>{block.focus}</Text>
              </View>
            </View>
          ))}
        </GlassCard>
      </Appear>

      <Appear delay={180}>
        <GlassCard style={styles.stack}>
          <SectionHeader title="This week" meta="Execution" />
          {WEEK.map((item) => (
            <View key={item.day} style={styles.weekRow}>
              <View style={styles.weekDay}>
                <Text style={styles.weekDayText}>{item.day}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.weekTitle}>{item.title}</Text>
                <Text style={styles.weekMeta}>{item.duration}</Text>
              </View>
              <Text style={styles.weekEnergy}>{item.energy}</Text>
            </View>
          ))}
        </GlassCard>
      </Appear>
    </ScrollView>
  );
}

const GoalOption = memo(function GoalOption({
  goal,
  active,
  onPress,
}: {
  goal: GoalLevel;
  active: boolean;
  onPress: (goal: GoalLevel) => void;
}) {
  return (
    <PressableScale onPress={() => onPress(goal)} haptic="selection" scaleTo={0.98}>
      <View style={[styles.goalOption, active && styles.goalOptionActive]}>
        <View style={styles.goalOptionTop}>
          <Text style={[styles.goalOptionTitle, active && { color: palette.violet }]}>{goal}</Text>
          {active ? <View style={styles.goalCheck} /> : null}
        </View>
        <Text style={styles.goalOptionCopy}>{GOAL_COPY[goal]}</Text>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  stack: {
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
    fontSize: 28,
    fontWeight: '800',
    color: palette.text,
  },
  heroCopy: {
    fontSize: 12,
    color: palette.textFaint,
    fontWeight: '600',
  },
  ringValue: {
    fontSize: 18,
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
  group: {
    gap: 10,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.textMuted,
    marginLeft: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  goalOption: {
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: palette.glassSunken,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
    gap: 6,
  },
  goalOptionActive: {
    borderColor: 'rgba(139,107,255,0.65)',
    backgroundColor: 'rgba(139,107,255,0.12)',
  },
  goalOptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  goalOptionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
    flex: 1,
  },
  goalCheck: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.violet,
  },
  goalOptionCopy: {
    fontSize: 12,
    lineHeight: 18,
    color: palette.textFaint,
  },
  stretch: {
    gap: 8,
    backgroundColor: 'rgba(255,182,92,0.10)',
    borderColor: 'rgba(255,182,92,0.28)',
  },
  stretchTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.amber,
  },
  stretchCopy: {
    fontSize: 13,
    lineHeight: 20,
    color: palette.textMuted,
  },
  stretchAccent: {
    fontWeight: '800',
    color: palette.amber,
  },
  blockRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  blockStep: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.glassStrong,
    marginTop: 2,
  },
  blockStepText: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.text,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.text,
    flex: 1,
  },
  blockMinutes: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.cyan,
  },
  blockFocus: {
    fontSize: 12,
    lineHeight: 18,
    color: palette.textFaint,
    marginTop: 3,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weekDay: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.glassStrong,
  },
  weekDayText: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.text,
  },
  weekTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
  weekMeta: {
    fontSize: 12,
    color: palette.textFaint,
    marginTop: 2,
  },
  weekEnergy: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.textFaint,
  },
});
