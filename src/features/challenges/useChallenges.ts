import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { teamsApi, type ChallengeSummary } from '../../api/teams';
import { dayKey } from '../../lib/time';
import { useAppState } from '../../state/DataContext';
import { useAuth } from '../../state/AuthContext';
import { victoriesWon, victoryDay } from '../../state/victories';
import type { VictoryLog } from '../../state/types';
import { daysInRange } from './period';

/**
 * Challenges for one team, scored from your own 3 Victories.
 *
 * The daily challenge is not a second copy of 3 Victories — it *is* 3
 * Victories, read over a window. Every challenge, whatever its length, counts
 * the same unit: victories won per day, nought to three. One rule, one number.
 *
 * The number is worked out here, on the device, from a log the server has
 * never seen inside. Only the total is sent, and only for a challenge you
 * joined. That is what makes a leaderboard possible without publishing
 * anybody's training: a score of 18 says you won 18 victories, and nothing
 * about which, or when, or what your targets were.
 */
export function scoreFor(log: VictoryLog, from: string, to: string): number {
  let total = 0;
  for (const day of daysInRange(from, to)) {
    total += victoriesWon(victoryDay(log, day));
  }
  return total;
}

export function useChallenges(teamId: string) {
  const { token } = useAuth();
  const state = useAppState();
  const [summaries, setSummaries] = useState<ChallengeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  /** Scores already pushed this session, so a re-render is not a re-upload. */
  const pushed = useRef(new Map<string, number>());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!token) return;
    const result = await teamsApi.challenges(token, teamId);
    if (!mounted.current) return;
    if (result.ok) setSummaries(result.data.challenges);
    setLoading(false);
  }, [teamId, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** What each joined challenge is worth right now, from local data. */
  const localScores = useMemo(() => {
    const out = new Map<string, number>();
    if (!state) return out;
    for (const row of summaries) {
      out.set(
        row.challenge.id,
        scoreFor(state.victories.log, row.challenge.periodStart, row.challenge.periodEnd),
      );
    }
    return out;
  }, [state, summaries]);

  /**
   * Push a score when it has actually moved.
   *
   * Only for challenges you joined — an unjoined one is not scored at all, not
   * scored privately. Guarded against re-sending the same number so opening
   * the screen twice is not two writes.
   */
  useEffect(() => {
    if (!token) return;
    for (const row of summaries) {
      if (!row.joined) continue;
      const local = localScores.get(row.challenge.id) ?? 0;
      if (local === row.myScore || pushed.current.get(row.challenge.id) === local) continue;
      pushed.current.set(row.challenge.id, local);
      void teamsApi.reportScore(token, row.challenge.id, local).then((result) => {
        if (result.ok && mounted.current) void reload();
      });
    }
  }, [localScores, reload, summaries, token]);

  const join = useCallback(
    async (challengeId: string) => {
      if (!token) return false;
      const result = await teamsApi.joinChallenge(token, challengeId);
      if (!result.ok) return false;
      // Clear the guard so the first real score goes up straight away rather
      // than waiting for the next change.
      pushed.current.delete(challengeId);
      await reload();
      return true;
    },
    [reload, token],
  );

  const leave = useCallback(
    async (challengeId: string) => {
      if (!token) return false;
      const result = await teamsApi.leaveChallenge(token, challengeId);
      if (!result.ok) return false;
      pushed.current.delete(challengeId);
      await reload();
      return true;
    },
    [reload, token],
  );

  const today = dayKey();

  return { summaries, localScores, loading, today, reload, join, leave };
}
