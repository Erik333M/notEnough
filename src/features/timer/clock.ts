/**
 * Worklet-safe duration formatters.
 *
 * These run on the Reanimated UI runtime so the stopwatch digits can be updated
 * every frame without touching React or the JS thread. Keep them allocation-free
 * and free of anything that is not available inside a worklet.
 */

function pad2(value: number): string {
  'worklet';
  return value < 10 ? `0${value}` : `${value}`;
}

/** ms -> "MM:SS.d" (or "H:MM:SS" past an hour). */
export function formatClock(ms: number): string {
  'worklet';
  const safe = ms < 0 ? 0 : ms;
  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  const tenths = Math.floor((safe % 1000) / 100);
  return `${pad2(minutes)}:${pad2(seconds)}.${tenths}`;
}

/** ms -> "MM:SS", rounded up, for countdowns. */
export function formatCountdown(ms: number): string {
  'worklet';
  const safe = ms < 0 ? 0 : ms;
  const totalSeconds = Math.ceil(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  return `${pad2(minutes)}:${pad2(totalSeconds % 60)}`;
}
