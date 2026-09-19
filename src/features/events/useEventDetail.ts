import { useCallback, useEffect, useRef, useState } from 'react';

import { eventsApi, type EventDetail, type EventInput } from '../../api/events';
import type { TeamRole } from '../../api/teams';
import { useAuth } from '../../state/AuthContext';

/**
 * One event, and the things staff can do to it.
 *
 * Every mutation re-reads the event rather than patching state locally. The
 * counts and the roster are derived server-side from memberships that somebody
 * else may also be changing; guessing at them here is how a screen ends up
 * confidently showing a stale number.
 */
export function useEventDetail(eventId: string) {
  const { token, user } = useAuth();
  const [data, setData] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    const result = await eventsApi.detail(token, eventId);
    if (!mounted.current) return;
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [eventId, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const update = useCallback(
    async (input: EventInput) => {
      if (!token) return { ok: false as const, message: 'Sign in first.' };
      const result = await eventsApi.update(token, eventId, input);
      if (!result.ok) return { ok: false as const, message: result.error.message };
      await refresh();
      return { ok: true as const };
    },
    [eventId, refresh, token],
  );

  const setMember = useCallback(
    async (userId: string, change: { role?: TeamRole; status?: 'active' | 'pending' }) => {
      if (!token || !data) return { ok: false as const, message: 'Sign in first.' };
      setBusy(userId);
      const result = await eventsApi.setMember(token, data.team.id, userId, change);
      if (result.ok) await refresh();
      if (!mounted.current) return { ok: false as const, message: '' };
      setBusy(null);
      if (!result.ok) return { ok: false as const, message: result.error.message };
      return { ok: true as const };
    },
    [data, refresh, token],
  );

  const isStaff = data?.role === 'coach';

  return {
    data,
    loading,
    error,
    busy,
    isStaff,
    myId: user?.id ?? null,
    refresh,
    update,
    setMember,
  };
}
