import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { dayKey, dayOfMonth, formatDuration, formatMinutes, formatPace, recentDayKeys } from '../lib/time';
import { useActions, useAppState, useStats } from '../state/DataContext';
import {
  activeDayCount,
  bestStreak,
  completionSeries,
  dayCompletion,
  totalRunDistance,
  totalRunTime,
} from '../state/selectors';
import type { RunSession } from '../state/types';
import { palette, radius } from '../theme/theme';
import { Appear, Pill, SectionHeader, StatTile } from '../ui/Controls';
import { EmptyState, SkeletonCard } from '../ui/Feedback';
import { GlassCard } from '../ui/Glass';
import { ColumnChart, ProgressRing } from '../ui/Progress';
import { useToast } from '../ui/Toast';
import { PressableScale } from '../ui/Touchable';

const HEAT_DAYS = 28;

export default function ProgressScreen({ bottomInset }: { bottomInset: number }) {
  const state = useAppState();
  const shared = useStats();
  const { deleteRun } = useActions();
  const { notify } = useToast();

  // Screen-specific history math, memoised per state change. The 7-day series
  // is built once and the average derived from it — it used to be computed
  // twice, walking the whole log for nothing.
  const stats = useMemo(() => {
    if (!state || !shared) return null;
    const { goals, todayKey } = shared;
    const series = completionSeries(state, 7);

    return {
      best: bestStreak(state),
      activeDays: activeDayCount(state),
      distance: totalRunDistance(state),
      time: totalRunTime(state),
      series,
      weekAverage: series.reduce((sum, point) => sum + point.value, 0) / series.length,
      heat: recentDayKeys(HEAT_DAYS).map((key) => ({
        key,
        value: dayCompletion(state, key, goals),
        today: key === todayKey,
      })),
    };
  }, [state, shared]);

  const handleDeleteRun = useCallback(
    (id: string) => {
      deleteRun(id);
      notify('Session removed.', 'info');
    },
    [deleteRun, notify],
  );

  if (!state || !stats || !shared) {
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
              <Pill label="Consistency" icon="flame" accent="amber" />
              <Text style={styles.heroTitle}>{shared.streak} day streak</Text>
              <Text style={styles.heroCopy}>
                Best run so far: {stats.best} days • {stats.activeDays} active days logged
              </Text>
            </View>
            <ProgressRing progress={stats.weekAverage / 100} size={92} accent="amber">
              <Text style={styles.ringValue}>{Math.round(stats.weekAverage)}%</Text>
              <Text style={styles.ringLabel}>7d avg</Text>
            </ProgressRing>
          </View>

          <View style={styles.statRow}>
            <StatTile value={`${(stats.distance / 1000).toFixed(1)} km`} label="Total distance" accent="cyan" />
            <StatTile value={formatMinutes(stats.time / 60000)} label="Time moving" accent="violet" />
            <StatTile value={`${state.runs.length}`} label="Sessions" accent="lime" />
          </View>
        </GlassCard>
      </Appear>

      <Appear delay={60}>
        <GlassCard style={styles.stack}>
          <SectionHeader title="Last 7 days" meta="Average goal completion" />
          <ColumnChart data={stats.series} accent="violet" />
        </GlassCard>
      </Appear>

      <Appear delay={100}>
        <GlassCard style={styles.stack}>
          <SectionHeader title="Last 4 weeks" meta="Darker means a fuller day" />
          <View style={styles.heatGrid}>
            {stats.heat.map((cell) => (
              <HeatCell key={cell.key} dayLabel={dayOfMonth(cell.key)} value={cell.value} today={cell.today} />
            ))}
          </View>
          <View style={styles.legend}>
            <Text style={styles.legendText}>Less</Text>
            {[0.05, 0.35, 0.6, 0.85, 1].map((v) => (
              <View key={v} style={[styles.legendDot, { backgroundColor: heatColor(v) }]} />
            ))}
            <Text style={styles.legendText}>More</Text>
          </View>
        </GlassCard>
      </Appear>

      <Appear delay={140}>
        <GlassCard style={styles.stack}>
          <SectionHeader
            title="Run history"
            meta={state.runs.length ? 'Long-press to remove' : undefined}
          />
          {state.runs.length === 0 ? (
            <EmptyState
              icon="stopwatch-outline"
              title="No sessions yet"
              copy="Save a run from the timer and it will show up here with pace and splits."
            />
          ) : (
            state.runs.slice(0, 20).map((run) => (
              <RunRow key={run.id} run={run} onDelete={handleDeleteRun} />
            ))
          )}
        </GlassCard>
      </Appear>
    </ScrollView>
  );
}

const HeatCell = memo(function HeatCell({
  dayLabel,
  value,
  today,
}: {
  dayLabel: string;
  value: number;
  today: boolean;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={[
        styles.heatCell,
        { backgroundColor: heatColor(value) },
        today && styles.heatCellToday,
      ]}
    >
      <Text style={[styles.heatText, value > 0.5 && { color: palette.onAccent }]}>{dayLabel}</Text>
    </Animated.View>
  );
});

const RunRow = memo(function RunRow({
  run,
  onDelete,
}: {
  run: RunSession;
  onDelete: (id: string) => void;
}) {
  const date = new Date(run.startedAt);
  const label = `${date.getDate()}/${date.getMonth() + 1}`;

  return (
    <Animated.View layout={LinearTransition} entering={FadeIn.duration(200)}>
      <PressableScale
        onLongPress={() => onDelete(run.id)}
        haptic="none"
        scaleTo={0.98}
        style={styles.runRow}
      >
        <View style={styles.runIcon}>
          <Ionicons
            name={run.mode === 'interval' ? 'repeat' : 'walk'}
            size={16}
            color={palette.cyan}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.runTitle}>
            {run.mode === 'interval' ? 'Interval session' : 'Run'} • {label}
          </Text>
          <Text style={styles.runMeta}>
            {formatDuration(run.durationMs, false)}
            {run.distanceM > 0 ? ` • ${(run.distanceM / 1000).toFixed(2)} km` : ''}
            {run.laps.length > 0 ? ` • ${run.laps.length} laps` : ''}
          </Text>
        </View>
        {run.distanceM > 0 ? (
          <View style={styles.paceTag}>
            <Text style={styles.paceValue}>{formatPace(run.distanceM, run.durationMs)}</Text>
            <Text style={styles.paceLabel}>/km</Text>
          </View>
        ) : null}
      </PressableScale>
    </Animated.View>
  );
});

function heatColor(value: number): string {
  if (value <= 0.02) return 'rgba(255,255,255,0.06)';
  if (value < 0.3) return 'rgba(139,107,255,0.28)';
  if (value < 0.6) return 'rgba(139,107,255,0.5)';
  if (value < 0.85) return 'rgba(139,107,255,0.75)';
  return '#8B6BFF';
}

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
    fontSize: 24,
    fontWeight: '800',
    color: palette.text,
  },
  heroCopy: {
    fontSize: 12,
    lineHeight: 18,
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
  heatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  heatCell: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatCellToday: {
    borderWidth: 1.5,
    borderColor: palette.cyan,
  },
  heatText: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.textFaint,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontSize: 11,
    color: palette.textFaint,
    fontWeight: '600',
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.hairline,
  },
  runIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cyanSoft,
  },
  runTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.text,
  },
  runMeta: {
    fontSize: 12,
    color: palette.textFaint,
    marginTop: 2,
    fontWeight: '600',
  },
  paceTag: {
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: palette.glassSunken,
  },
  paceValue: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
  paceLabel: {
    fontSize: 10,
    color: palette.textFaint,
    fontWeight: '700',
  },
});
