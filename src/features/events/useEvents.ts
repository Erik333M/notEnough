import { useCallback, useEffect, useRef, useState } from 'react';

import { eventsApi, type EventInput, type EventSummary } from '../../api/events';
import { useAuth } from '../../state/AuthContext';

/**
 * The events you are part of.
 *
 * Deliberately its own hook rather than a slice of TeamsContext: somebody with
 * no events should pay nothing for the feature, and the list is only ever read
 * by the one screen that shows it.
 */
export function useEvents() {
  const { token } = useAuth();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    const result = await eventsApi.list(token);
    if (!mounted.current) return;
    if (result.ok) setEvents(result.data.events);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: EventInput) => {
      if (!token) return { ok: false as const, message: 'Sign in first.' };
      const result = await eventsApi.create(token, input);
      if (!result.ok) return { ok: false as const, message: result.error.message };
      await refresh();
      return { ok: true as const, created: result.data };
    },
    [refresh, token],
  );

  return { events, loading, refresh, create };
}
