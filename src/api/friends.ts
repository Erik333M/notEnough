import { request, type ApiResult } from './client';

/**
 * Friends, codes and published profiles.
 *
 * There is no search endpoint here and there is not meant to be. You reach
 * somebody by their code or through a team you share; the app deliberately
 * offers no way to look a person up, because that would also be a way to
 * discover who has an account.
 */

export type FriendStatus = 'pending' | 'accepted';

/**
 * Everything one person can see of another.
 *
 * Six fields. The figures are published by the owner's own device from data
 * this server never reads, so they say how someone is doing without saying
 * anything about what they did.
 */
export type PublicProfile = {
  userId: string;
  name: string;
  streak: number;
  level: number;
  daysWon: number;
  /** Null until their device has published anything. */
  updatedAt: string | null;
};

export type Friendship = {
  id: string;
  status: FriendStatus;
  profile: PublicProfile;
};

type FriendLists = {
  friends: Friendship[];
  /** People who asked you. Only you can answer these. */
  incoming: Friendship[];
  /** People you asked, still waiting. */
  outgoing: Friendship[];
};

export const friendsApi = {
  /** Yours to share. Generated the first time it is asked for, then stable. */
  code: (token: string): Promise<ApiResult<{ code: string }>> =>
    request('/api/friends/code', { token }),

  list: (token: string): Promise<ApiResult<FriendLists>> => request('/api/friends', { token }),

  /** By code. A code belonging to nobody answers the same as any other miss. */
  request: (token: string, code: string): Promise<ApiResult<{ friendship: Friendship }>> =>
    request('/api/friends/request', { method: 'POST', token, body: { code } }),

  /** By id, and only for somebody on a roster you are also on. */
  requestTeammate: (token: string, userId: string): Promise<ApiResult<{ friendship: Friendship }>> =>
    request('/api/friends/request-teammate', { method: 'POST', token, body: { userId } }),

  accept: (token: string, friendshipId: string): Promise<ApiResult<{ friendship: Friendship }>> =>
    request(`/api/friends/${friendshipId}/accept`, { method: 'POST', token }),

  /** Decline, cancel or unfriend — the same act from three directions. */
  remove: (token: string, friendshipId: string): Promise<ApiResult<null>> =>
    request(`/api/friends/${friendshipId}`, { method: 'DELETE', token }),

  /** Publish your own figures. Only ever your own. */
  publish: (
    token: string,
    body: { streak: number; level: number; daysWon: number },
  ): Promise<ApiResult<{ profile: PublicProfile }>> =>
    request('/api/friends/profile', { method: 'PUT', token, body }),

  profile: (
    token: string,
    userId: string,
  ): Promise<ApiResult<{ profile: PublicProfile; isFriend: boolean }>> =>
    request(`/api/friends/${userId}/profile`, { token }),
};
