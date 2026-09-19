import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Assignment, RosterEntry } from '../../api/teams';
import { teamsApi } from '../../api/teams';
import { useAuth } from '../../state/AuthContext';

/**
 * The jobs an event's staff have been given.
 *
 * There is no rota table behind this. A job is a standalone assignment with a
 * title, an owner and a date, which is the row the work routes already hand
 * out — so a job is ticked off, withdrawn and shown by exactly the machinery
 * that handles a drill, and there is no second set of rules about who may do
 * what to it.
 *
 * Filtering to staff happens here rather than on the server: the work endpoint
 * already answers correctly for whoever asks, and narrowing it to a rota is a
 * question about this screen, not about access.
 */
export function useStaffRota(teamId: string, roster: RosterEntry[]) {
  const { token, user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    const result = await teamsApi.teamWork(token, teamId);
    if (!mounted.current) return;
    if (result.ok) setAssignments(result.data.assignments);
    setLoading(false);
  }, [teamId, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const staff = useMemo(
    () => roster.filter((row) => row.role === 'coach' && row.status === 'active'),
    [roster],
  );

  /** Only jobs belonging to staff, and only standalone ones — not session work. */
  const jobs = useMemo(() => {
    const ids = new Set(staff.map((row) => row.userId));
    return assignments
      .filter((row) => row.sessionId === null && ids.has(row.assigneeUserId))
      .sort(
        (a, b) =>
          Number(Boolean(a.result?.done)) - Number(Boolean(b.result?.done)) ||
          a.dueDate.localeCompare(b.dueDate),
      );
  }, [assignments, staff]);

  const run = useCallback(
    async (key: string, action: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
      if (!token) return { ok: false as const, message: 'Sign in first.' };
      setBusy(key);
      const result = await action();
      if (result.ok) await refresh();
      if (!mounted.current) return { ok: false as const, message: '' };
      setBusy(null);
      return result.ok
        ? { ok: true as const, message: '' }
        : { ok: false as const, message: result.error?.message ?? 'That did not work.' };
    },
    [refresh, token],
  );

  return {
    jobs,
    staff,
    loading,
    busy,
    myId: user?.id ?? null,
    refresh,
    give: (assigneeUserId: string, title: string, dueDate: string) =>
      run('give', () =>
        teamsApi.assignWork(token!, teamId, {
          assigneeUserIds: [assigneeUserId],
          title,
          kind: 'check',
          target: 1,
          dueDate,
        }),
      ),
    // Only the person it belongs to may tick it off, so the button is theirs
    // alone; the server refuses anybody else and the screen does not offer it.
    tick: (assignmentId: string, done: boolean) =>
      run(assignmentId, () => teamsApi.logResult(token!, assignmentId, { amount: done ? 1 : 0, done })),
    withdraw: (assignmentId: string) => run(assignmentId, () => teamsApi.removeWork(token!, assignmentId)),
  };
}
