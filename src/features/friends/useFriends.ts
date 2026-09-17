import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { friendsApi, type Friendship } from '../../api/friends';
import { useAppState, useStats } from '../../state/DataContext';
import { useAuth } from '../../state/AuthContext';
import { totalDaysWon } from '../../state/victories';
import { levelFor } from './level';

/**
 * Your friends, your code, and the figures you publish to them.
 *
 * The publishing is the part worth reading twice. Streak, level and days won
 * are worked out here, on the device, from a log the server never reads into
 * — and only those three numbers are sent. A friend learns that you are on a
 * thirty day streak; nothing about it tells them what any of those days held.
 *
 * It republishes only when a figure has actually moved, so opening the screen
 * is not a write.
 */
export function useFriends() {
  const { token } = useAuth();
  const state = useAppState();
  const stats = useStats();

  const [friends, setFriends] = useState<Friendship[]>([]);
  const [incoming, setIncoming] = useState<Friendship[]>([]);
  const [outgoing, setOutgoing] = useState<Friendship[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const published = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!token) return;
    const [list, mine] = await Promise.all([friendsApi.list(token), friendsApi.code(token)]);
    if (!mounted.current) return;
    if (list.ok) {
      setFriends(list.data.friends);
      setIncoming(list.data.incoming);
      setOutgoing(list.data.outgoing);
    }
    if (mine.ok) setCode(mine.data.code);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** What this device would publish, if it has anything to publish. */
  const figures = useMemo(() => {
    if (!state || !stats) return null;
    const daysWon = totalDaysWon(state.victories.log);
    return { streak: stats.streak, daysWon, level: levelFor(daysWon) };
  }, [state, stats]);

  useEffect(() => {
    if (!token || !figures) return;
    const signature = `${figures.streak}:${figures.level}:${figures.daysWon}`;
    if (published.current === signature) return;
    published.current = signature;
    void friendsApi.publish(token, figures);
  }, [figures, token]);

  const requestByCode = useCallback(
    async (entered: string): Promise<{ ok: true } | { ok: false; message: string }> => {
      if (!token) return { ok: false, message: 'You need to be online to add a friend.' };
      const result = await friendsApi.request(token, entered.trim().toUpperCase());
      if (!result.ok) {
        return {
          ok: false,
          message:
            result.error.code === 'no_such_code'
              ? 'No one uses that code. Check it with them.'
              : result.error.message,
        };
      }
      await reload();
      return { ok: true };
    },
    [reload, token],
  );

  const accept = useCallback(
    async (friendshipId: string) => {
      if (!token) return false;
      const result = await friendsApi.accept(token, friendshipId);
      if (!result.ok) return false;
      await reload();
      return true;
    },
    [reload, token],
  );

  const remove = useCallback(
    async (friendshipId: string) => {
      if (!token) return false;
      const result = await friendsApi.remove(token, friendshipId);
      if (!result.ok) return false;
      await reload();
      return true;
    },
    [reload, token],
  );

  return { friends, incoming, outgoing, code, figures, loading, reload, requestByCode, accept, remove };
}
