import { useCallback } from 'react';

import { friendsApi } from '../../api/friends';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../ui/Toast';
import { useFriends } from './useFriends';

/**
 * Adding a friend from a team roster.
 *
 * Kept apart from the team screen because it is a friends concern that
 * happens to be rendered there. The state comes from the live friend lists
 * rather than anything stored per row, so the button disappears the moment a
 * request goes out instead of waiting for the screen to be reopened.
 */
export function useTeammateFriends() {
  const { token } = useAuth();
  const { notify } = useToast();
  const friends = useFriends();

  const friendStateFor = useCallback(
    (id: string): 'none' | 'pending' | 'friends' => {
      if (friends.friends.some((row) => row.profile.userId === id)) return 'friends';
      if ([...friends.incoming, ...friends.outgoing].some((row) => row.profile.userId === id)) {
        return 'pending';
      }
      return 'none';
    },
    [friends.friends, friends.incoming, friends.outgoing],
  );

  const addTeammate = useCallback(
    async (id: string, name: string) => {
      if (!token) return;
      const result = await friendsApi.requestTeammate(token, id);
      if (!result.ok) {
        notify(result.error.message, 'error');
        return;
      }
      await friends.reload();
      notify(`Request sent to ${name}.`, 'success');
    },
    [friends, notify, token],
  );

  return { friendStateFor, addTeammate };
}
