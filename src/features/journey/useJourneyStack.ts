import { useCallback, useMemo, useReducer } from 'react';

import type { DayKey } from '../../state/journey/types';

/**
 * Navigation inside the Success Journey tab.
 *
 * The app's shell is a flat route switch with no params and no history, which
 * is fine for seven peer screens but cannot express "the entry for 12 March"
 * or a back path out of it. Rather than introduce a navigator for one feature,
 * the tab owns a small typed stack of its own: the shell still sees a single
 * `journey` route, and everything below it is this.
 *
 * Views carry their params in the union, so a screen cannot be pushed without
 * the data it needs — the failure mode a param-less flat switch invites.
 */
export type JourneyView =
  | { key: 'home' }
  | { key: 'entry'; date: DayKey }
  | { key: 'wod'; date: DayKey }
  | { key: 'movements' }
  | { key: 'benchmarks' }
  | { key: 'benchmark'; id: string }
  | { key: 'measurements' }
  | { key: 'habits' }
  | { key: 'progress' };

type Action =
  | { type: 'push'; view: JourneyView }
  | { type: 'pop' }
  | { type: 'reset' };

/** Root is always present, so `at(-1)` is never undefined. */
type Stack = [JourneyView, ...JourneyView[]];

const ROOT: JourneyView = { key: 'home' };

function reducer(stack: Stack, action: Action): Stack {
  switch (action.type) {
    case 'push':
      return [...stack, action.view];

    case 'pop':
      // Never pops the root: the tab must always render something.
      return stack.length > 1 ? (stack.slice(0, -1) as Stack) : stack;

    case 'reset':
      return stack.length === 1 ? stack : [ROOT];

    default:
      return stack;
  }
}

export type JourneyNav = {
  view: JourneyView;
  canGoBack: boolean;
  openEntry: (date: DayKey) => void;
  openWod: (date: DayKey) => void;
  openMovements: () => void;
  openBenchmarks: () => void;
  openBenchmark: (id: string) => void;
  openMeasurements: () => void;
  openHabits: () => void;
  openProgress: () => void;
  back: () => void;
  /** Returns to the root — used when the tab is re-selected. */
  reset: () => void;
};

export function useJourneyStack(): JourneyNav {
  const [stack, dispatch] = useReducer(reducer, [ROOT] as Stack);

  const openEntry = useCallback((date: DayKey) => {
    dispatch({ type: 'push', view: { key: 'entry', date } });
  }, []);

  const openWod = useCallback((date: DayKey) => {
    dispatch({ type: 'push', view: { key: 'wod', date } });
  }, []);

  const openMovements = useCallback(() => {
    dispatch({ type: 'push', view: { key: 'movements' } });
  }, []);

  const openBenchmarks = useCallback(() => {
    dispatch({ type: 'push', view: { key: 'benchmarks' } });
  }, []);

  const openBenchmark = useCallback((id: string) => {
    dispatch({ type: 'push', view: { key: 'benchmark', id } });
  }, []);

  const openMeasurements = useCallback(() => {
    dispatch({ type: 'push', view: { key: 'measurements' } });
  }, []);

  const openHabits = useCallback(() => {
    dispatch({ type: 'push', view: { key: 'habits' } });
  }, []);

  const openProgress = useCallback(() => {
    dispatch({ type: 'push', view: { key: 'progress' } });
  }, []);

  const back = useCallback(() => dispatch({ type: 'pop' }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  return useMemo(
    () => ({
      view: stack[stack.length - 1],
      canGoBack: stack.length > 1,
      openEntry,
      openWod,
      openMovements,
      openBenchmarks,
      openBenchmark,
      openMeasurements,
      openHabits,
      openProgress,
      back,
      reset,
    }),
    [
      stack,
      openEntry,
      openWod,
      openMovements,
      openBenchmarks,
      openBenchmark,
      openMeasurements,
      openHabits,
      openProgress,
      back,
      reset,
    ],
  );
}
