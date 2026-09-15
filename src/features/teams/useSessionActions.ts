import { useCallback, useState } from 'react';

import { teamsApi, type Assignment, type RosterEntry, type TaskKind } from '../../api/teams';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../ui/Toast';

/**
 * Everything a session screen can change.
 *
 * Pulled out of the screen so the screen is layout and this is behaviour. Each
 * one reloads afterwards rather than patching local state: this data is shared
 * with other people, so the server's answer is the only one worth trusting.
 */
export function useSessionActions(sessionId: string, reload: () => Promise<void>) {
  const { token } = useAuth();
  const { notify } = useToast();
  const [handingOut, setHandingOut] = useState(false);

  const addTask = useCallback(
    async (input: { title: string; detail: string; kind: TaskKind; target: number }) => {
      if (!token) return false;
      const result = await teamsApi.addTask(token, sessionId, input);
      if (!result.ok) {
        notify(result.error.message, 'error');
        return false;
      }
      await reload();
      return true;
    },
    [notify, reload, sessionId, token],
  );

  const removeTask = useCallback(
    async (taskId: string) => {
      if (!token) return;
      const result = await teamsApi.removeTask(token, sessionId, taskId);
      if (!result.ok) {
        notify(result.error.message, 'error');
        return;
      }
      await reload();
      notify('Task removed, and withdrawn from anyone who had it.', 'success');
    },
    [notify, reload, sessionId, token],
  );

  const handOut = useCallback(
    async (roster: RosterEntry[]) => {
      if (!token) return;
      // Athletes only. A coach holds an active membership too, so taking every
      // member would hand the coach their own session and put them in their own
      // progress list — which reads as a bug even when it is not one. A
      // player-coach who wants the work can be given it deliberately.
      const athletes = roster
        .filter((row) => row.status === 'active' && row.role === 'athlete')
        .map((row) => row.userId);
      setHandingOut(true);
      const result = await teamsApi.handOut(token, sessionId, athletes);
      setHandingOut(false);
      if (!result.ok) {
        notify(result.error.message, 'error');
        return;
      }
      await reload();
      notify(
        result.data.added === 0
          ? 'Everyone already has this session.'
          : `Sent to the squad — ${result.data.added} new task${result.data.added === 1 ? '' : 's'}.`,
        'success',
      );
    },
    [notify, reload, sessionId, token],
  );

  const setShared = useCallback(
    async (next: boolean) => {
      if (!token) return;
      const result = await teamsApi.updateSession(token, sessionId, { shareResults: next });
      if (!result.ok) {
        notify(result.error.message, 'error');
        return;
      }
      await reload();
    },
    [notify, reload, sessionId, token],
  );

  /**
   * Mark one of your own tasks done, or undo it.
   *
   * A measured task records its full target when ticked this way; anything
   * more precise belongs in the athlete's own logging screen. `done` is stored
   * rather than inferred, so an undo is a real state and not an absence.
   */
  const toggleDone = useCallback(
    async (row: Assignment) => {
      if (!token) return;
      const next = !row.result?.done;
      const result = await teamsApi.logResult(token, row.id, {
        amount: next ? row.target : 0,
        done: next,
      });
      if (!result.ok) {
        notify(result.error.message, 'error');
        return;
      }
      await reload();
    },
    [notify, reload, token],
  );

  return { addTask, removeTask, handOut, setShared, toggleDone, handingOut };
}
