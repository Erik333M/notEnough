import { useCallback, useEffect, useRef, useState } from 'react';

import { friendsApi, type FeedPost } from '../../api/friends';
import { useAuth } from '../../state/AuthContext';

/**
 * What your friends have shown off.
 *
 * Read on every visit rather than cached: a feed that is stale is worse than a
 * feed that is briefly empty, and there is nothing here worth keeping on the
 * device — it is other people's posts, and who may see them can change between
 * one open and the next.
 */
export function useFeed() {
  const { token, user } = useAuth();
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [friendCount, setFriendCount] = useState(0);
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
    const result = await friendsApi.feed(token);
    if (!mounted.current) return;
    if (result.ok) {
      setFeed(result.data.feed);
      setFriendCount(result.data.friendCount);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = useCallback(
    async (shareId: string) => {
      if (!token) return;
      const result = await friendsApi.removePost(token, shareId);
      if (result.ok && mounted.current) setFeed((prev) => prev.filter((row) => row.id !== shareId));
    },
    [token],
  );

  return { feed, friendCount, loading, myId: user?.id ?? null, refresh, remove };
}
