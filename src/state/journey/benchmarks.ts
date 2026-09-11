/**
 * Benchmarks — test, re-test, and see whether it moved.
 *
 * As with movements, the seed definitions in data/benchmarks.json are merged at
 * read time and only custom definitions are persisted.
 */

import seed from './data/benchmarks.json';
import { readBenchmarkDefinition } from './readers';
import type {
  BenchmarkDefinition,
  BenchmarkGroup,
  BenchmarkMetric,
  BenchmarkResult,
  JourneyState,
  UnitSystem,
} from './types';
import { displayWeight, formatSeconds, roundTo, weightUnit } from './units';

const SEED_BENCHMARKS: BenchmarkDefinition[] = (seed.benchmarks as unknown[])
  .map((row) => {
    const parsed = readBenchmarkDefinition(row);
    return parsed ? { ...parsed, isCustom: false } : null;
  })
  .filter((b): b is BenchmarkDefinition => b !== null);

export const BENCHMARK_GROUP_LABEL: Record<BenchmarkGroup, string> = {
  monostructural: 'Cardio',
  gymnastics: 'Gymnastics',
  weightlifting: 'Weightlifting',
};

export const BENCHMARK_METRIC_LABEL: Record<BenchmarkMetric, string> = {
  time: 'Time',
  duration: 'Hold',
  reps: 'Max effort',
  weight: 'One rep max',
};

export function allBenchmarks(state: JourneyState): BenchmarkDefinition[] {
  return [...state.benchmarks, ...SEED_BENCHMARKS];
}

export function benchmarkById(state: JourneyState, id: string): BenchmarkDefinition | null {
  return allBenchmarks(state).find((b) => b.id === id) ?? null;
}

/**
 * Which direction is an improvement.
 *
 * Derived from the metric rather than stored per benchmark, so a definition
 * cannot claim to be a timed test while scoring like a max-effort one. A
 * faster 400 m is a lower number; everything else improves upward.
 */
export function lowerIsBetter(metric: BenchmarkMetric): boolean {
  return metric === 'time';
}

export function isBetter(metric: BenchmarkMetric, candidate: number, best: number): boolean {
  return lowerIsBetter(metric) ? candidate < best : candidate > best;
}

/** One benchmark's results, newest first. */
export function resultsFor(state: JourneyState, definitionId: string): BenchmarkResult[] {
  return state.results
    .filter((r) => r.definitionId === definitionId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function resultCount(state: JourneyState, definitionId: string): number {
  let count = 0;
  for (const result of state.results) if (result.definitionId === definitionId) count += 1;
  return count;
}

/** The best result on record, or null if the benchmark has never been tested. */
export function personalBest(
  state: JourneyState,
  definition: BenchmarkDefinition,
): BenchmarkResult | null {
  let best: BenchmarkResult | null = null;
  for (const result of state.results) {
    if (result.definitionId !== definition.id) continue;
    if (!best || isBetter(definition.metric, result.value, best.value)) best = result;
  }
  return best;
}

export function latestResult(
  state: JourneyState,
  definitionId: string,
): BenchmarkResult | null {
  let latest: BenchmarkResult | null = null;
  for (const result of state.results) {
    if (result.definitionId !== definitionId) continue;
    if (!latest || result.date > latest.date) latest = result;
  }
  return latest;
}

/**
 * Whether a result was a personal best *at the time it was set*.
 *
 * Takes the row's position rather than the row itself, and `results` must be
 * the newest-first array `resultsFor()` returns. Position is the only reliable
 * ordering available: two results can share a date (tested twice in a session,
 * or a correction logged the same evening), and ids are random UUIDs, so
 * comparing them would decide the badge by coin flip.
 *
 * Because the array is sorted newest-first and the sort is stable over
 * insertion order, everything at a *higher* index happened earlier. Comparing
 * only against those means back-filling an old session cannot retroactively
 * strip the badge from the session that actually broke the record.
 *
 * Ties are not personal bests — matching your best is not beating it.
 */
export function wasPersonalBest(
  results: BenchmarkResult[],
  metric: BenchmarkMetric,
  index: number,
): boolean {
  const result = results[index];
  if (!result) return false;

  let best: number | null = null;
  for (let i = index + 1; i < results.length; i += 1) {
    const value = results[i].value;
    if (best === null || isBetter(metric, value, best)) best = value;
  }
  return best === null || isBetter(metric, result.value, best);
}

/**
 * A benchmark's results oldest-first, for a trend line.
 *
 * Built by reversing `resultsFor` rather than sorting ascending independently.
 * Sorting by date alone leaves same-day results in `state.results` order,
 * which is newest-inserted-first — so two results logged on one day would plot
 * backwards under a chart captioned "oldest to newest". Reversing the
 * newest-first array keeps one ordering rule for the whole module.
 */
export function benchmarkSeries(
  state: JourneyState,
  definitionId: string,
): Array<{ date: string; value: number }> {
  return resultsFor(state, definitionId)
    .slice()
    .reverse()
    .map((r) => ({ date: r.date, value: r.value }));
}

/** Renders a stored value in the unit its metric implies. */
export function formatBenchmarkValue(
  value: number,
  metric: BenchmarkMetric,
  units: UnitSystem,
): string {
  switch (metric) {
    case 'time':
    case 'duration':
      return formatSeconds(value);
    case 'reps':
      return `${Math.round(value)}`;
    case 'weight': {
      const shown = displayWeight(value, units) ?? 0;
      return `${roundTo(shown, 1)} ${weightUnit(units)}`;
    }
  }
}

export function benchmarksByGroup(
  definitions: BenchmarkDefinition[],
): Array<{ group: BenchmarkGroup; label: string; items: BenchmarkDefinition[] }> {
  return (Object.keys(BENCHMARK_GROUP_LABEL) as BenchmarkGroup[])
    .map((group) => ({
      group,
      label: BENCHMARK_GROUP_LABEL[group],
      items: definitions.filter((b) => b.group === group),
    }))
    .filter((entry) => entry.items.length > 0);
}

/** Most recent results across every benchmark — the progress overview's "recent PRs". */
export function recentPersonalBests(
  state: JourneyState,
  limit = 5,
): Array<{ definition: BenchmarkDefinition; result: BenchmarkResult }> {
  const out: Array<{ definition: BenchmarkDefinition; result: BenchmarkResult }> = [];

  for (const definition of allBenchmarks(state)) {
    const results = resultsFor(state, definition.id);
    // Newest-first, so the first hit is the most recent record this test saw.
    for (let i = 0; i < results.length; i += 1) {
      if (wasPersonalBest(results, definition.metric, i)) {
        out.push({ definition, result: results[i] });
        break;
      }
    }
  }

  return out
    .sort((a, b) => (a.result.date < b.result.date ? 1 : a.result.date > b.result.date ? -1 : 0))
    .slice(0, limit);
}
