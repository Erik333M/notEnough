import { useCallback, useEffect, useRef, useState } from 'react';

import { statsApi, type GamesView, type StatEntry } from '../../api/event-stats';
import { useAuth } from '../../state/AuthContext';

const EMPTY: GamesView = {
  games: [],
  fields: [],
  standings: [],
  leaders: [],
  canManage: false,
};

/**
 * Fixtures, the table, the leaderboards, and the schema behind all three.
 *
 * One hook because it is one read. The table is computed from the games and
 * the games are scored by the fields, so fetching them separately would only
 * create a window in which the screen contradicted itself.
 */
export function useGames(eventId: string) {
  const { token } = useAuth();
  const [view, setView] = useState<GamesView>(EMPTY);
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
    const result = await statsApi.games(token, eventId);
    if (!mounted.current) return;
    if (result.ok) setView(result.data);
    setLoading(false);
  }, [eventId, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    ...view,
    loading,
    busy,
    refresh,
    addField: (label: string, scope: 'team' | 'player') =>
      run('field', () => statsApi.addField(token!, eventId, label, scope)),
    renameField: (fieldId: string, label: string) =>
      run(fieldId, () => statsApi.updateField(token!, eventId, fieldId, { label })),
    dropField: (fieldId: string) =>
      run(fieldId, () => statsApi.updateField(token!, eventId, fieldId, { archived: true })),
    addGame: (game: { homeTeamId: string; awayTeamId: string; playedOn: string; title?: string }) =>
      run('game', () => statsApi.addGame(token!, eventId, game)),
    saveStats: (gameId: string, entries: StatEntry[]) =>
      run(gameId, () => statsApi.saveStats(token!, eventId, gameId, entries)),
    removeGame: (gameId: string) => run(gameId, () => statsApi.removeGame(token!, eventId, gameId)),
  };
}
