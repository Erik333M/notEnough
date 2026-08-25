import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { AppState as RNAppState } from 'react-native';

import { makeId } from '../lib/crypto';
import { flushWrites, queueWrite, readJSON, storageKeys } from '../lib/storage';
import { dayKey } from '../lib/time';
import { cancelReminder, resyncReminders, scheduleGoalReminder } from '../notifications/notifications';
import { createInitialState, migrate } from './defaults';
import { activeGoals, currentStreak, dayCompletion, goalsClosed } from './selectors';
import { push, reconcile, type SyncStatus } from './sync';
import {
  dayScore,
  goalDef,
  isGoalDone,
  victoriesWon,
  victoryDay,
  victoryStreak,
  withGoalDone,
} from './victories';
import type {
  AppState,
  Goal,
  PlanConfig,
  Reminder,
  RunSession,
  VictoryDay,
  VictoryGoalKey,
} from './types';

/* ------------------------------------------------------------------ reducer */

type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'addGoal'; goal: Goal }
  | { type: 'updateGoal'; id: string; patch: Partial<Goal> }
  | { type: 'deleteGoal'; id: string }
  | { type: 'setProgress'; goalId: string; day: string; amount: number }
  | { type: 'addProgress'; goalId: string; day: string; delta: number; max: number }
  | { type: 'addRun'; run: RunSession }
  | { type: 'deleteRun'; id: string }
  | { type: 'updatePlan'; patch: Partial<PlanConfig> }
  | { type: 'clearDay'; day: string }
  | { type: 'toggleVictoryGoal'; day: string; goal: VictoryGoalKey }
  | { type: 'setVictoryTarget'; goal: VictoryGoalKey; target: string };

function writeLog(state: AppState, day: string, goalId: string, amount: number): AppState {
  const dayEntries = state.log[day];
  const next = Math.max(0, Math.round(amount));
  if ((dayEntries?.[goalId] ?? 0) === next) return state;

  return {
    ...state,
    log: { ...state.log, [day]: { ...dayEntries, [goalId]: next } },
  };
}

function baseReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state;

    case 'addGoal':
      return { ...state, goals: [action.goal, ...state.goals] };

    case 'updateGoal': {
      const index = state.goals.findIndex((g) => g.id === action.id);
      if (index === -1) return state;
      const goals = state.goals.slice();
      goals[index] = { ...goals[index], ...action.patch };
      return { ...state, goals };
    }

    case 'deleteGoal':
      return { ...state, goals: state.goals.filter((g) => g.id !== action.id) };

    case 'setProgress':
      return writeLog(state, action.day, action.goalId, action.amount);

    case 'addProgress': {
      const current = state.log[action.day]?.[action.goalId] ?? 0;
      return writeLog(state, action.day, action.goalId, Math.min(action.max, current + action.delta));
    }

    case 'addRun':
      // Newest first, capped so the log cannot grow without bound.
      return { ...state, runs: [action.run, ...state.runs].slice(0, 200) };

    case 'deleteRun':
      return { ...state, runs: state.runs.filter((r) => r.id !== action.id) };

    case 'updatePlan':
      return { ...state, plan: { ...state.plan, ...action.patch } };

    case 'clearDay': {
      if (!state.log[action.day]) return state;
      const log = { ...state.log };
      delete log[action.day];
      return { ...state, log };
    }

    case 'toggleVictoryGoal': {
      // Only ever writes the addressed day, so yesterday can never be rewritten
      // by today's tap.
      const day = victoryDay(state.victories.log, action.day);
      const next = withGoalDone(day, action.goal, !isGoalDone(day, action.goal));
      return {
        ...state,
        victories: { ...state.victories, log: { ...state.victories.log, [action.day]: next } },
      };
    }

    case 'setVictoryTarget': {
      const target = action.target.trim() || goalDef(action.goal).defaultTarget;
      if (state.victories.targets[action.goal] === target) return state;
      return {
        ...state,
        victories: {
          ...state.victories,
          targets: { ...state.victories.targets, [action.goal]: target },
        },
      };
    }

    default:
      return state;
  }
}

/**
 * Stamps `updatedAt` in one place instead of in nine reducer branches. If a
 * case returns the same object (a no-op edit) the stamp is skipped, so a
 * redundant tap never marks the state dirty and never triggers a sync.
 */
function reducer(state: AppState, action: Action): AppState {
  const next = baseReducer(state, action);
  if (next === state || action.type === 'hydrate') return next;
  return { ...next, updatedAt: Date.now() };
}

/* ----------------------------------------------------------------- context */

export type GoalDraft = Omit<Goal, 'id' | 'createdAt' | 'archived' | 'reminder'> & {
  reminder: Omit<Reminder, 'notificationId'>;
};

type Actions = {
  addGoal: (draft: GoalDraft) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  setReminder: (
    id: string,
    reminder: Omit<Reminder, 'notificationId'>,
    overrides?: Partial<Pick<Goal, 'title' | 'detail' | 'kind' | 'target'>>,
  ) => void;
  addProgress: (goalId: string, delta: number) => void;
  setProgress: (goalId: string, amount: number) => void;
  completeGoal: (goalId: string) => void;
  addRun: (run: Omit<RunSession, 'id'>) => void;
  deleteRun: (id: string) => void;
  updatePlan: (patch: Partial<PlanConfig>) => void;
  clearToday: () => void;
  /** Toggles one of the nine daily victory goals for today. */
  toggleVictoryGoal: (goal: VictoryGoalKey) => void;
  setVictoryTarget: (goal: VictoryGoalKey, target: string) => void;
};

/** Numbers several screens need. Computed once here, not once per consumer. */
type Stats = {
  todayKey: string;
  goals: Goal[];
  todayCompletion: number;
  todayClosed: number;
  streak: number;
  /** Today's nine victory goals, plus the counts derived from them. */
  victoryToday: VictoryDay;
  /** Goals closed today, 0..9. */
  victoryScore: number;
  /** Victories won today, 0..3. */
  victoriesWon: number;
  /** Consecutive days with all nine won. */
  victoryStreak: number;
};

type Sync = {
  status: SyncStatus;
  lastSyncedAt: number | null;
  syncNow: () => void;
};

const StateContext = createContext<AppState | null>(null);
const ActionsContext = createContext<Actions | null>(null);
const StatsContext = createContext<Stats | null>(null);
const SyncContext = createContext<Sync | null>(null);

const PUSH_DEBOUNCE_MS = 1500;

/**
 * Offline-first data layer.
 *
 * The local reducer is always the source of truth for what is on screen — every
 * tap lands instantly and is never blocked on a request. Persistence to disk
 * and to the API are both background echoes of that state.
 */
export function DataProvider({
  userId,
  token,
  onUnauthorized,
  children,
}: {
  userId: string;
  token: string | null;
  onUnauthorized: () => void;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, null as unknown as AppState);
  const hydrated = state != null;

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const stateRef = useRef<AppState | null>(null);
  stateRef.current = state ?? null;

  const tokenRef = useRef(token);
  tokenRef.current = token;

  /** `updatedAt` value we last confirmed the server holds. */
  const syncedStamp = useRef<number>(0);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  /** A sync was requested while one was already running. */
  const queued = useRef(false);
  const mounted = useRef(true);

  const storageKey = storageKeys.appState(userId);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, []);

  const applyOutcome = useCallback(
    (outcome: Awaited<ReturnType<typeof reconcile>>) => {
      if (!mounted.current) return;
      switch (outcome.kind) {
        case 'adopt':
          dispatch({ type: 'hydrate', state: outcome.state });
          syncedStamp.current = outcome.state.updatedAt;
          setSyncStatus('synced');
          setLastSyncedAt(Date.now());
          break;
        case 'pushed':
          syncedStamp.current = outcome.updatedAt;
          setSyncStatus('synced');
          setLastSyncedAt(Date.now());
          break;
        case 'unchanged':
          syncedStamp.current = stateRef.current?.updatedAt ?? 0;
          setSyncStatus('synced');
          setLastSyncedAt(Date.now());
          break;
        case 'offline':
          setSyncStatus('offline');
          break;
        case 'unauthorized':
          setSyncStatus('error');
          onUnauthorized();
          break;
        case 'error':
          setSyncStatus('error');
          break;
      }
    },
    [onUnauthorized],
  );

  const runSync = useCallback(
    async (mode: 'reconcile' | 'push') => {
      const activeToken = tokenRef.current;
      const current = stateRef.current;
      if (!activeToken || !current) return;

      // Only one request at a time, but a request that arrives during one must
      // not be dropped: edits made while a push was in flight would otherwise
      // sit unsent until the *next* edit happened to schedule another push.
      if (inFlight.current) {
        queued.current = true;
        return;
      }

      inFlight.current = true;
      if (mounted.current) setSyncStatus('syncing');

      try {
        const outcome =
          mode === 'reconcile'
            ? await reconcile(activeToken, current)
            : await push(activeToken, current);
        applyOutcome(outcome);
      } finally {
        inFlight.current = false;
      }

      if (queued.current && mounted.current) {
        queued.current = false;
        const latest = stateRef.current;
        if (latest && latest.updatedAt !== syncedStamp.current) await runSyncRef.current('push');
      }
    },
    [applyOutcome],
  );

  // Lets the tail of `runSync` call the latest version of itself without
  // making the callback depend on its own identity.
  const runSyncRef = useRef(runSync);
  runSyncRef.current = runSync;

  // 1. Paint from disk, 2. re-arm reminders, 3. reconcile with the server.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const raw = await readJSON<unknown>(storageKey, null);
      if (cancelled) return;

      const loaded = raw ? migrate(raw) : createInitialState();
      dispatch({ type: 'hydrate', state: loaded });

      const ids = await resyncReminders(loaded.goals);
      if (!cancelled && ids) {
        for (const goal of loaded.goals) {
          const id = ids[goal.id] ?? null;
          if (goal.reminder.notificationId !== id) {
            dispatch({
              type: 'updateGoal',
              id: goal.id,
              patch: { reminder: { ...goal.reminder, notificationId: id } },
            });
          }
        }
      }

      if (!cancelled) void runSync('reconcile');
    })();

    return () => {
      cancelled = true;
    };
  }, [storageKey, runSync]);

  // Persist locally on every change (debounced), and schedule a push.
  useEffect(() => {
    if (!hydrated) return;
    queueWrite(storageKey, state);

    if (!tokenRef.current) return;
    if (state.updatedAt === syncedStamp.current) return;

    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => void runSync('push'), PUSH_DEBOUNCE_MS);
  }, [state, hydrated, storageKey, runSync]);

  // Leaving the foreground is the last safe moment to flush both caches.
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (status) => {
      if (status === 'active') {
        void runSync('reconcile');
        return;
      }
      flushWrites();
      if (stateRef.current && stateRef.current.updatedAt !== syncedStamp.current) {
        void runSync('push');
      }
    });
    return () => {
      sub.remove();
      flushWrites();
    };
  }, [runSync]);

  const actions = useMemo<Actions>(() => {
    const findGoal = (id: string) => stateRef.current?.goals.find((g) => g.id === id);

    return {
      addGoal(draft) {
        const goal: Goal = {
          ...draft,
          id: makeId(),
          createdAt: new Date().toISOString(),
          archived: false,
          reminder: { ...draft.reminder, notificationId: null },
        };
        dispatch({ type: 'addGoal', goal });

        if (goal.reminder.enabled) {
          scheduleGoalReminder(goal).then((notificationId) => {
            if (!notificationId) return;
            dispatch({
              type: 'updateGoal',
              id: goal.id,
              patch: { reminder: { ...goal.reminder, notificationId } },
            });
          });
        }
      },

      updateGoal(id, patch) {
        dispatch({ type: 'updateGoal', id, patch });
      },

      deleteGoal(id) {
        const goal = findGoal(id);
        cancelReminder(goal?.reminder.notificationId);
        dispatch({ type: 'deleteGoal', id });
      },

      setReminder(id, reminder, overrides) {
        const goal = findGoal(id);
        if (!goal) return;

        // Cancel first so a disabled/edited reminder can never leave an orphan
        // notification scheduled in the OS.
        cancelReminder(goal.reminder.notificationId);
        const next: Reminder = { ...reminder, notificationId: null };
        dispatch({ type: 'updateGoal', id, patch: { reminder: next } });

        if (!reminder.enabled) return;
        scheduleGoalReminder({ ...goal, ...overrides, reminder: next }).then((notificationId) => {
          if (!notificationId) return;
          dispatch({ type: 'updateGoal', id, patch: { reminder: { ...next, notificationId } } });
        });
      },

      addProgress(goalId, delta) {
        const goal = findGoal(goalId);
        if (!goal) return;
        dispatch({ type: 'addProgress', goalId, day: dayKey(), delta, max: goal.target * 3 });
      },

      setProgress(goalId, amount) {
        dispatch({ type: 'setProgress', goalId, day: dayKey(), amount });
      },

      completeGoal(goalId) {
        const goal = findGoal(goalId);
        if (!goal) return;
        const day = dayKey();
        const current = stateRef.current?.log[day]?.[goalId] ?? 0;
        dispatch({
          type: 'setProgress',
          goalId,
          day,
          amount: current >= goal.target ? 0 : goal.target,
        });
      },

      addRun(run) {
        dispatch({ type: 'addRun', run: { ...run, id: makeId() } });
      },

      deleteRun(id) {
        dispatch({ type: 'deleteRun', id });
      },

      updatePlan(patch) {
        dispatch({ type: 'updatePlan', patch });
      },

      clearToday() {
        dispatch({ type: 'clearDay', day: dayKey() });
      },

      toggleVictoryGoal(goal) {
        // Resolved at dispatch time, so a session left open past midnight logs
        // against the new day rather than the one the screen mounted on.
        dispatch({ type: 'toggleVictoryGoal', day: dayKey(), goal });
      },

      setVictoryTarget(goal, target) {
        dispatch({ type: 'setVictoryTarget', goal, target });
      },
    };
  }, []);

  /**
   * Derived numbers used by the header, Today and Progress. Computing them once
   * here rather than in each screen turns three passes over the whole history
   * per keystroke into one.
   */
  const stats = useMemo<Stats | null>(() => {
    if (!state) return null;
    const today = dayKey();
    const goals = activeGoals(state);
    const victoryToday = victoryDay(state.victories.log, today);
    return {
      todayKey: today,
      goals,
      todayCompletion: dayCompletion(state, today, goals),
      todayClosed: goalsClosed(state, today, goals),
      streak: currentStreak(state),
      victoryToday,
      victoryScore: dayScore(victoryToday),
      victoriesWon: victoriesWon(victoryToday),
      victoryStreak: victoryStreak(state.victories.log),
    };
  }, [state]);

  const sync = useMemo<Sync>(
    () => ({
      status: syncStatus,
      lastSyncedAt,
      syncNow: () => void runSync('reconcile'),
    }),
    [syncStatus, lastSyncedAt, runSync],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <SyncContext.Provider value={sync}>
        <StatsContext.Provider value={stats}>
          <StateContext.Provider value={state ?? null}>{children}</StateContext.Provider>
        </StatsContext.Provider>
      </SyncContext.Provider>
    </ActionsContext.Provider>
  );
}

/** Null while the user's state is still hydrating from disk. */
export function useAppState(): AppState | null {
  return useContext(StateContext);
}

export function useActions(): Actions {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error('useActions must be used inside <DataProvider>');
  return ctx;
}

/** Null until hydration finishes. */
export function useStats(): Stats | null {
  return useContext(StatsContext);
}

export function useSync(): Sync {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside <DataProvider>');
  return ctx;
}
