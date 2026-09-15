import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { teamsApi, type Share } from '../../api/teams';
import { useAuth } from '../../state/AuthContext';
import { useTeams } from '../../state/TeamsContext';
import type { Achievement } from './derive';

/**
 * What you have already shown a team, and how to show them something new.
 *
 * The "already shared" set is read back from the server rather than remembered
 * on the device: a post made from another phone is still a post, and offering
 * to share it again would be the app forgetting something the team can see.
 *
 * Solo users never reach any of this — with no memberships there is nothing to
 * fetch and nothing to post to.
 */
export function useSharing() {
  const { token, user } = useAuth();
  const { memberships } = useTeams();
  const [mine, setMine] = useState<Share[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const teamIds = useMemo(() => memberships.map((row) => row.team.id).join(','), [memberships]);

  const reload = useCallback(async () => {
    if (!token || !teamIds) {
      setMine([]);
      return;
    }
    const ids = teamIds.split(',');
    const results = await Promise.all(ids.map((id) => teamsApi.shares(token, id)));
    if (!mounted.current) return;

    const posts: Share[] = [];
    for (const result of results) {
      if (result.ok) posts.push(...result.data.shares.filter((row) => row.userId === user?.id));
    }
    setMine(posts);
  }, [teamIds, token, user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Keyed by achievement, so the same milestone is offered once per team. */
  const sharedIds = useMemo(() => new Set(mine.map((row) => row.achievementId)), [mine]);

  const share = useCallback(
    async (achievement: Achievement, teamId: string, note: string): Promise<boolean> => {
      if (!token) return false;
      const result = await teamsApi.share(token, teamId, {
        kind: achievement.kind,
        achievementId: achievement.id,
        title: achievement.title,
        detail: achievement.detail,
        value: achievement.value,
        achievedAt: achievement.achievedAt,
        note,
      });
      if (!result.ok) return false;
      await reload();
      return true;
    },
    [reload, token],
  );

  return { sharedIds, share, reload };
}
