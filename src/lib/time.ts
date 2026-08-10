/** Date + duration helpers. All "day keys" are local-time YYYY-MM-DD strings. */

export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Last `count` day keys ending today, oldest first. */
export function recentDayKeys(count: number, from: Date = new Date()): string[] {
  const keys: string[] = new Array(count);
  for (let i = 0; i < count; i += 1) keys[i] = dayKey(addDays(from, i - count + 1));
  return keys;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function weekdayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

export function dayOfMonth(key: string): string {
  return key.slice(8, 10);
}

export function clockLabel(hour: number, minute: number): string {
  return `${`${hour}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`;
}

/** ms -> "M:SS.d" (stopwatch) or "H:MM:SS" past an hour. */
export function formatDuration(ms: number, withTenths = true): string {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((safe % 1000) / 100);

  if (hours > 0) {
    return `${hours}:${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`;
  }
  const base = `${minutes}:${`${seconds}`.padStart(2, '0')}`;
  return withTenths ? `${base}.${tenths}` : base;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Pace in min/km from metres + ms. */
export function formatPace(metres: number, ms: number): string {
  if (metres < 20 || ms < 1000) return '--:--';
  const minutesPerKm = ms / 60000 / (metres / 1000);
  const m = Math.floor(minutesPerKm);
  const s = Math.round((minutesPerKm - m) * 60);
  return `${m}:${`${s}`.padStart(2, '0')}`;
}
