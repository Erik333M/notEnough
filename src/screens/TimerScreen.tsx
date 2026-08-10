import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { memo, useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
} from 'react-native-reanimated';

import { TimerDigits } from '../features/timer/TimerDigits';
import { useRunTimer } from '../features/timer/useRunTimer';
import { formatDuration, formatPace } from '../lib/time';
import { useActions } from '../state/DataContext';
import type { RunMode } from '../state/types';
import { palette, radius } from '../theme/theme';
import { Button } from '../ui/Button';
import { Appear, Pill, RoundIconButton, SectionHeader, Segmented, StatTile } from '../ui/Controls';
import { EmptyState } from '../ui/Feedback';
import { GlassCard } from '../ui/Glass';
import { LiveProgressRing } from '../ui/Progress';
import { useToast } from '../ui/Toast';
import { PressableScale } from '../ui/Touchable';

const MODES = [
  { value: 'stopwatch' as RunMode, label: 'Stopwatch' },
  { value: 'interval' as RunMode, label: 'Intervals' },
];

export default function TimerScreen({ bottomInset }: { bottomInset: number }) {
  const [mode, setMode] = useState<RunMode>('stopwatch');

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Appear>
        <Segmented options={MODES} value={mode} onChange={setMode} />
      </Appear>

      {mode === 'stopwatch' ? <StopwatchPanel /> : <IntervalPanel />}
    </ScrollView>
  );
}

/* -------------------------------------------------------------- stopwatch */

const DISTANCE_STEPS = [100, 400, 1000];

function StopwatchPanel() {
  const timer = useRunTimer();
  const { addRun } = useActions();
  const { notify } = useToast();
  const [distance, setDistance] = useState(0);
  const [saving, setSaving] = useState(false);

  const { running, started, laps, start, pause, reset, lap, read, elapsed } = timer;

  const handleSave = useCallback(() => {
    const durationMs = read();
    if (durationMs < 1000) {
      notify('Run a little longer before saving.', 'info');
      return;
    }
    setSaving(true);
    addRun({
      startedAt: new Date(Date.now() - durationMs).toISOString(),
      durationMs,
      distanceM: distance,
      laps: [...laps].reverse(),
      mode: 'stopwatch',
    });
    notify('Session saved to your progress.', 'success');
    reset();
    setDistance(0);
    setSaving(false);
  }, [addRun, distance, laps, notify, read, reset]);

  const splits = useMemo(() => {
    // Laps are stored newest-first; a split is the gap to the previous lap.
    return laps.map((value, index) => ({
      index: laps.length - index,
      total: value,
      split: index === laps.length - 1 ? value : value - laps[index + 1],
    }));
  }, [laps]);

  return (
    <>
      <Appear delay={40}>
        <GlassCard style={styles.clockCard} elevated>
          <Pill
            label={running ? 'Recording' : started ? 'Paused' : 'Ready'}
            icon={running ? 'radio-button-on' : 'time-outline'}
            accent={running ? 'lime' : 'cyan'}
          />
          <TimerDigits value={elapsed} size={64} />
          <View style={styles.statRow}>
            <StatTile value={`${(distance / 1000).toFixed(2)} km`} label="Distance" />
            <PaceTile distance={distance} read={read} running={running} />
            <StatTile value={`${laps.length}`} label="Laps" />
          </View>

          <View style={styles.controlRow}>
            <RoundIconButton
              icon="refresh"
              onPress={reset}
              disabled={!started}
              size={52}
            />
            <PressableScale
              onPress={running ? pause : start}
              haptic="heavy"
              scaleTo={0.93}
              style={styles.primaryControl}
            >
              <View style={[styles.primaryControlInner, running && styles.primaryControlActive]}>
                <Ionicons
                  name={running ? 'pause' : 'play'}
                  size={30}
                  color={running ? palette.rose : palette.onAccent}
                />
              </View>
            </PressableScale>
            <RoundIconButton icon="flag" onPress={lap} disabled={!running} size={52} accent="cyan" />
          </View>
        </GlassCard>
      </Appear>

      <Appear delay={80}>
        <GlassCard style={styles.stack}>
          <SectionHeader title="Distance" meta="Tap to add as you go" />
          <View style={styles.distanceRow}>
            {DISTANCE_STEPS.map((step) => (
              <PressableScale
                key={step}
                haptic="selection"
                scaleTo={0.94}
                style={styles.distanceChipWrap}
                onPress={() => setDistance((d) => d + step)}
              >
                <View style={styles.distanceChip}>
                  <Text style={styles.distanceChipText}>
                    +{step >= 1000 ? `${step / 1000}km` : `${step}m`}
                  </Text>
                </View>
              </PressableScale>
            ))}
            <RoundIconButton
              icon="backspace-outline"
              size={44}
              onPress={() => setDistance(0)}
              disabled={distance === 0}
            />
          </View>
          <Button
            label={saving ? 'Saving…' : 'Save session'}
            icon="cloud-upload-outline"
            onPress={handleSave}
            disabled={!started}
            loading={saving}
          />
        </GlassCard>
      </Appear>

      <Appear delay={120}>
        <GlassCard style={styles.stack}>
          <SectionHeader title="Laps" meta={laps.length ? `${laps.length} recorded` : undefined} />
          {splits.length === 0 ? (
            <EmptyState
              icon="flag-outline"
              title="No laps yet"
              copy="Hit the flag while running to capture a split without breaking stride."
            />
          ) : (
            splits.map((item) => <LapRow key={item.index} {...item} />)
          )}
        </GlassCard>
      </Appear>
    </>
  );
}

const LapRow = memo(function LapRow({
  index,
  total,
  split,
}: {
  index: number;
  total: number;
  split: number;
}) {
  return (
    <Animated.View entering={FadeIn.duration(200)} layout={LinearTransition} style={styles.lapRow}>
      <View style={styles.lapBadge}>
        <Text style={styles.lapBadgeText}>{index}</Text>
      </View>
      <Text style={styles.lapSplit}>{formatDuration(split)}</Text>
      <Text style={styles.lapTotal}>{formatDuration(total)}</Text>
    </Animated.View>
  );
});

/**
 * Pace only needs to be right when the user looks at it, so it samples the
 * shared value on demand instead of subscribing to every frame.
 */
const PaceTile = memo(function PaceTile({
  distance,
  read,
  running,
}: {
  distance: number;
  read: () => number;
  running: boolean;
}) {
  // `running` is in the dep list so the label refreshes on each start/pause.
  const pace = useMemo(() => formatPace(distance, read()), [distance, read, running]);
  return <StatTile value={`${pace}`} label="min / km" accent="cyan" />;
});

/* --------------------------------------------------------------- intervals */

function IntervalPanel() {
  const timer = useRunTimer();
  const { addRun } = useActions();
  const { notify } = useToast();
  const [workSec, setWorkSec] = useState(60);
  const [restSec, setRestSec] = useState(30);
  const [rounds, setRounds] = useState(8);

  const { running, started, start, pause, reset, read, elapsed } = timer;

  const workMs = workSec * 1000;
  const restMs = restSec * 1000;
  const cycleMs = workMs + restMs;
  const totalMs = cycleMs * rounds;

  const [phase, setPhase] = useState<{ round: number; work: boolean }>({ round: 1, work: true });

  const onPhase = useCallback((round: number, work: boolean) => {
    setPhase({ round, work });
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        work
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
    }
  }, []);

  const onFinish = useCallback(() => {
    pause();
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    notify('Interval session complete.', 'success');
  }, [notify, pause]);

  // Phase index recomputed on the UI thread; React only hears about *changes*.
  const phaseIndex = useDerivedValue(() => {
    const capped = Math.min(elapsed.value, totalMs);
    const round = Math.floor(capped / cycleMs);
    const inCycle = capped - round * cycleMs;
    return round * 2 + (inCycle < workMs ? 0 : 1);
  }, [cycleMs, workMs, totalMs]);

  useAnimatedReaction(
    () => phaseIndex.value,
    (current, previous) => {
      if (previous === null || current === previous) return;
      runOnJS(onPhase)(Math.floor(current / 2) + 1, current % 2 === 0);
    },
    [onPhase],
  );

  useAnimatedReaction(
    () => elapsed.value >= totalMs,
    (done, previous) => {
      if (done && previous === false) runOnJS(onFinish)();
    },
    [totalMs, onFinish],
  );

  const remaining = useDerivedValue(() => {
    const capped = Math.min(elapsed.value, totalMs);
    const round = Math.floor(capped / cycleMs);
    const inCycle = capped - round * cycleMs;
    return inCycle < workMs ? workMs - inCycle : cycleMs - inCycle;
  }, [cycleMs, workMs, totalMs]);

  const phaseProgress = useDerivedValue(() => {
    const capped = Math.min(elapsed.value, totalMs);
    const round = Math.floor(capped / cycleMs);
    const inCycle = capped - round * cycleMs;
    return inCycle < workMs ? inCycle / workMs : (inCycle - workMs) / Math.max(1, restMs);
  }, [cycleMs, workMs, restMs, totalMs]);

  const handleReset = useCallback(() => {
    reset();
    setPhase({ round: 1, work: true });
  }, [reset]);

  const handleSave = useCallback(() => {
    const durationMs = read();
    if (durationMs < 1000) {
      notify('Nothing to save yet.', 'info');
      return;
    }
    addRun({
      startedAt: new Date(Date.now() - durationMs).toISOString(),
      durationMs,
      distanceM: 0,
      laps: [],
      mode: 'interval',
    });
    notify('Interval session saved.', 'success');
    handleReset();
  }, [addRun, handleReset, notify, read]);

  return (
    <>
      <Appear delay={40}>
        <GlassCard style={styles.clockCard} elevated>
          <Pill
            label={`Round ${Math.min(phase.round, rounds)} / ${rounds}`}
            icon="repeat"
            accent="violet"
          />
          <LiveProgressRing
            progress={phaseProgress}
            accent={phase.work ? 'cyan' : 'amber'}
            size={228}
          >
            <Text style={[styles.phaseLabel, !phase.work && { color: palette.amber }]}>
              {phase.work ? 'WORK' : 'RECOVER'}
            </Text>
            <TimerDigits value={remaining} mode="countdown" size={54} />
            <Text style={styles.phaseHint}>
              {phase.work ? `${workSec}s effort` : `${restSec}s easy`}
            </Text>
          </LiveProgressRing>

          <View style={styles.controlRow}>
            <RoundIconButton icon="refresh" onPress={handleReset} disabled={!started} size={52} />
            <PressableScale
              onPress={running ? pause : start}
              haptic="heavy"
              scaleTo={0.93}
              style={styles.primaryControl}
            >
              <View style={[styles.primaryControlInner, running && styles.primaryControlActive]}>
                <Ionicons
                  name={running ? 'pause' : 'play'}
                  size={30}
                  color={running ? palette.rose : palette.onAccent}
                />
              </View>
            </PressableScale>
            <RoundIconButton
              icon="checkmark"
              onPress={handleSave}
              disabled={!started}
              size={52}
              accent="lime"
            />
          </View>
        </GlassCard>
      </Appear>

      <Appear delay={90}>
        <GlassCard style={styles.stack}>
          <SectionHeader title="Session shape" meta={`Total ${formatDuration(totalMs, false)}`} />
          <IntervalStepper
            label="Work"
            value={workSec}
            suffix="s"
            step={15}
            min={15}
            max={600}
            onChange={setWorkSec}
            disabled={started}
          />
          <IntervalStepper
            label="Recover"
            value={restSec}
            suffix="s"
            step={15}
            min={0}
            max={600}
            onChange={setRestSec}
            disabled={started}
          />
          <IntervalStepper
            label="Rounds"
            value={rounds}
            suffix=""
            step={1}
            min={1}
            max={30}
            onChange={setRounds}
            disabled={started}
          />
          {started ? (
            <Text style={styles.lockedHint}>Reset the timer to change the session shape.</Text>
          ) : null}
        </GlassCard>
      </Appear>
    </>
  );
}

const IntervalStepper = memo(function IntervalStepper({
  label,
  value,
  suffix,
  step,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  suffix: string;
  step: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.intervalRow, disabled && styles.intervalRowDisabled]}>
      <Text style={styles.intervalLabel}>{label}</Text>
      <View style={styles.intervalControls}>
        <RoundIconButton
          icon="remove"
          size={36}
          disabled={disabled || value <= min}
          onPress={() => onChange(Math.max(min, value - step))}
        />
        <Text style={styles.intervalValue}>
          {value}
          {suffix}
        </Text>
        <RoundIconButton
          icon="add"
          size={36}
          disabled={disabled || value >= max}
          onPress={() => onChange(Math.min(max, value + step))}
        />
      </View>
    </View>
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
  clockCard: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 22,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  primaryControl: {
    borderRadius: 40,
  },
  primaryControlInner: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.lime,
  },
  primaryControlActive: {
    backgroundColor: palette.roseSoft,
    borderWidth: 2,
    borderColor: palette.rose,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  distanceChipWrap: {
    flex: 1,
  },
  distanceChip: {
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.glassStrong,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairlineStrong,
  },
  distanceChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: palette.text,
  },
  lapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.hairline,
  },
  lapBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.glassStrong,
  },
  lapBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.textMuted,
  },
  lapSplit: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
  lapTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.textFaint,
    fontVariant: ['tabular-nums'],
  },
  phaseLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    color: palette.cyan,
  },
  phaseHint: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.textFaint,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  intervalRowDisabled: {
    opacity: 0.5,
  },
  intervalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.textMuted,
  },
  intervalControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  intervalValue: {
    minWidth: 62,
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '800',
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
  lockedHint: {
    fontSize: 12,
    color: palette.textFaint,
    fontWeight: '600',
  },
});
