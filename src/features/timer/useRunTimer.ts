import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';

const KEEP_AWAKE_TAG = 'notenough-timer';

export type RunTimer = {
  /** Elapsed milliseconds. Lives on the UI thread; read `.value` from JS when needed. */
  elapsed: SharedValue<number>;
  running: boolean;
  started: boolean;
  laps: number[];
  start: () => void;
  pause: () => void;
  reset: () => void;
  lap: () => void;
  /** Snapshot of elapsed ms, safe to call from JS at any time. */
  read: () => number;
};

/**
 * Wall-clock stopwatch driven by a UI-thread frame callback.
 *
 * Two properties matter here:
 *  1. The elapsed value is derived from `Date.now()` each frame rather than
 *     accumulated frame deltas, so a backgrounded app, a dropped frame or a
 *     busy JS thread can never make the timer drift.
 *  2. Nothing re-renders while it runs — the digits are bound to the shared
 *     value through `useAnimatedProps`, so a 60fps readout costs zero React work.
 */
export function useRunTimer(): RunTimer {
  const elapsed = useSharedValue(0);
  const accumulated = useSharedValue(0);
  const startEpoch = useSharedValue(0);
  const isRunning = useSharedValue(false);

  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const keepAwakeActive = useRef(false);

  const frame = useFrameCallback(() => {
    'worklet';
    if (!isRunning.value) return;
    elapsed.value = accumulated.value + (Date.now() - startEpoch.value);
  }, false);

  // Only run the frame loop while the timer is active — an idle screen should
  // not be waking the UI thread 60 times a second.
  useEffect(() => {
    frame.setActive(running);
  }, [running, frame]);

  useEffect(() => {
    if (running && !keepAwakeActive.current) {
      keepAwakeActive.current = true;
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    } else if (!running && keepAwakeActive.current) {
      keepAwakeActive.current = false;
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    }
  }, [running]);

  useEffect(
    () => () => {
      if (keepAwakeActive.current) deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    },
    [],
  );

  const start = useCallback(() => {
    startEpoch.value = Date.now();
    isRunning.value = true;
    setRunning(true);
    setStarted(true);
  }, [isRunning, startEpoch]);

  const pause = useCallback(() => {
    if (!isRunning.value) return;
    accumulated.value += Date.now() - startEpoch.value;
    elapsed.value = accumulated.value;
    isRunning.value = false;
    setRunning(false);
  }, [accumulated, elapsed, isRunning, startEpoch]);

  const reset = useCallback(() => {
    isRunning.value = false;
    accumulated.value = 0;
    elapsed.value = 0;
    startEpoch.value = 0;
    setRunning(false);
    setStarted(false);
    setLaps([]);
  }, [accumulated, elapsed, isRunning, startEpoch]);

  const read = useCallback(() => elapsed.value, [elapsed]);

  const lap = useCallback(() => {
    const at = elapsed.value;
    setLaps((prev) => [at, ...prev].slice(0, 60));
  }, [elapsed]);

  return { elapsed, running, started, laps, start, pause, reset, lap, read };
}
