import { useCallback, useEffect, useRef, useState } from 'react';

import { eventsApi, type SquadList } from '../../api/events';
import { useAuth } from '../../state/AuthContext';

/**
 * The squads inside one event.
 *
 * Every change re-reads the whole list rather than patching it here. Placing
 * somebody in a squad takes them out of another one in the same write, so a
 * local edit would have to reproduce that rule on the device — and the first
 * time the two disagreed, the screen would be the one that was wrong.
 */
export function useSquads(eventId: string) {
  const { token } = useAuth();
  const [list, setList] = useState<SquadList>({ squads: [], unassigned: [], canManage: false });
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
    const result = await eventsApi.squads(token, eventId);
    if (!mounted.current) return;
    if (result.ok) setList(result.data);
    setLoading(false);
  }, [eventId, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Every mutation is the same shape: run it, re-read, report the message. */
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
    ...list,
    loading,
    busy,
    refresh,
    create: (name: string) => run('create', () => eventsApi.createSquad(token!, eventId, name)),
    rename: (teamId: string, name: string) =>
      run(teamId, () => eventsApi.renameSquad(token!, eventId, teamId, name)),
    disband: (teamId: string) => run(teamId, () => eventsApi.disbandSquad(token!, eventId, teamId)),
    place: (teamId: string, userId: string) =>
      run(userId, () => eventsApi.placeInSquad(token!, eventId, teamId, userId)),
    remove: (teamId: string, userId: string) =>
      run(userId, () => eventsApi.removeFromSquad(token!, eventId, teamId, userId)),
  };
}
