import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { friendsApi } from '../../api/friends';
import { teamsApi, type Share } from '../../api/teams';
import { useAuth } from '../../state/AuthContext';
import { useTeams } from '../../state/TeamsContext';
import type { Achievement } from './derive';

/**
 * What you have already shown, and how to show something new.
 *
 * The "already shared" set is read back from the server rather than remembered
 * on the device: a post made from another phone is still a post, and offering
 * to share it again would be the app forgetting something the team can see.
 *
 * Solo users with no friends never reach any of this — nothing to fetch and
 * nowhere to post to.
 *
 * "Already shared" is tracked per audience rather than as one flag. With only
 * teams that distinction did not exist; now that a post can go to your friends
 * instead, one flag would mean sharing to a squad quietly used up your only
 * chance to show the same thing to the people you added.
 */
export type Audience = { kind: 'team'; id: string } | { kind: 'friends' };
export function useSharing() {
  const { token, user } = useAuth();
  const { memberships } = useTeams();
  const [mine, setMine] = useState<Share[]>([]);
  const [friendPosts, setFriendPosts] = useState<Set<string>>(new Set());
  const [friendCount, setFriendCount] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const teamIds = useMemo(() => memberships.map((row) => row.team.id).join(','), [memberships]);

  const reload = useCallback(async () => {
    if (!token) {
      setMine([]);
      setFriendPosts(new Set());
      return;
    }

    const ids = teamIds ? teamIds.split(',') : [];
    const [teamResults, feed] = await Promise.all([
      Promise.all(ids.map((id) => teamsApi.shares(token, id))),
      friendsApi.feed(token),
    ]);
    if (!mounted.current) return;

    const posts: Share[] = [];
    for (const result of teamResults) {
      if (result.ok) posts.push(...result.data.shares.filter((row) => row.userId === user?.id));
    }
    setMine(posts);

    if (feed.ok) {
      setFriendCount(feed.data.friendCount);
      setFriendPosts(
        new Set(
          feed.data.feed.filter((row) => row.userId === user?.id).map((row) => row.achievementId),
        ),
      );
    }
  }, [teamIds, token, user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Which teams already have a given achievement, so a chip can say so. */
  const teamsWith = useCallback(
    (achievementId: string) =>
      new Set(mine.filter((row) => row.achievementId === achievementId).map((row) => row.teamId)),
    [mine],
  );

  const audiences = useMemo(
    () => memberships.length + (friendCount > 0 ? 1 : 0),
    [friendCount, memberships.length],
  );

  /**
   * Shown as "shared" only once there is nowhere left to share it.
   *
   * A card that still has an audience keeps its button, which is the whole
   * reason the two are tracked apart.
   */
  const sharedIds = useMemo(() => {
    const out = new Set<string>();
    const ids = new Set([...mine.map((row) => row.achievementId), ...friendPosts]);
    for (const id of ids) {
      const used = teamsWith(id).size + (friendPosts.has(id) ? 1 : 0);
      if (audiences > 0 && used >= audiences) out.add(id);
    }
    return out;
  }, [audiences, friendPosts, mine, teamsWith]);

  const share = useCallback(
    async (achievement: Achievement, audience: Audience, note: string): Promise<boolean> => {
      if (!token) return false;
      const body = {
        kind: achievement.kind,
        achievementId: achievement.id,
        title: achievement.title,
        detail: achievement.detail,
        value: achievement.value,
        achievedAt: achievement.achievedAt,
        note,
      };
      const result =
        audience.kind === 'friends'
          ? await friendsApi.postToFriends(token, body)
          : await teamsApi.share(token, audience.id, body);
      if (!result.ok) return false;
      await reload();
      return true;
    },
    [reload, token],
  );

  return { sharedIds, friendCount, friendPosts, teamsWith, share, reload };
}
