import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { teamsApi, type Assignment } from '../../api/teams';
import { dayKey } from '../../lib/time';
import { syncSessionReminders } from '../../notifications/sessionReminders';
import { useAuth } from '../../state/AuthContext';
import { useCapabilities } from '../../state/TeamsContext';

/**
 * The work a coach has set you, across every team.
 *
 * Fetched, never synced — it belongs to more than one person, so a local copy
 * is stale the moment a coach changes it. Solo users skip the request
 * entirely: with no memberships there is nothing to ask for, and the whole
 * feature should cost them nothing.
 */
export type MyWork = {
  /** Past due and unfinished. Shown first, because it is the pressing part. */
  overdue: Assignment[];
  today: Assignment[];
  /** The next few days, so nothing arrives as a surprise. */
  upcoming: Assignment[];
  /** Everything due today or overdue, finished or not. */
  outstanding: number;
  loading: boolean;
  reload: () => Promise<void>;
  log: (
    assignment: Assignment,
    input: { amount: number; done: boolean; notes?: string },
  ) => Promise<boolean>;
};

const UPCOMING_DAYS = 7;

export function useMyWork(): MyWork {
  const { token } = useAuth();
  const { hasTeams } = useCapabilities();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!token || !hasTeams) {
      setAssignments([]);
      setLoading(false);
      return;
    }
    const result = await teamsApi.myWork(token);
    if (!mounted.current) return;
    if (result.ok) {
      setAssignments(result.data.assignments);
      // Reminders are rebuilt from whatever we just learned. This is the only
      // moment the device can know about work a coach set while it was away.
      void syncSessionReminders(result.data.assignments, dayKey());
    }
    setLoading(false);
  }, [hasTeams, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const log = useCallback<MyWork['log']>(
    async (assignment, input) => {
      if (!token) return false;
      const result = await teamsApi.logResult(token, assignment.id, {
        amount: input.amount,
        done: input.done,
        notes: input.notes ?? '',
      });
      if (!result.ok) return false;
      await reload();
      return true;
    },
    [reload, token],
  );

  return useMemo(() => {
    const today = dayKey();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + UPCOMING_DAYS);
    const limit = dayKey(horizon);

    const overdue = assignments.filter((row) => row.dueDate < today && !row.result?.done);
    const dueToday = assignments.filter((row) => row.dueDate === today);
    const upcoming = assignments.filter(
      (row) => row.dueDate > today && row.dueDate <= limit && !row.result?.done,
    );

    return {
      overdue,
      today: dueToday,
      upcoming,
      outstanding: [...overdue, ...dueToday].filter((row) => !row.result?.done).length,
      loading,
      reload,
      log,
    };
  }, [assignments, loading, log, reload]);
}
