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
 * The figures are published by the owner's own device from data this server
 * never reads, so they say how someone is doing without saying anything about
 * what they did.
 */
export type PublicProfile = {
  userId: string;
  name: string;
  /**
   * A path to pass through `avatarSource`, or null for initials.
   *
   * Null on a pending request as well as on somebody who never set one: a
   * request is a question, and it grants no more than the name it has to.
   */
  avatarUrl: string | null;
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

/**
 * One post on a friend feed.
 *
 * The same row a team wall carries, with no team on it. Who can see it is
 * worked out from live friendships when the feed is read, not stamped on the
 * post — so unfriending somebody takes your posts back from them.
 */
export type FeedPost = {
  id: string;
  teamId: null;
  userId: string;
  authorName: string;
  avatarUrl: string | null;
  kind: 'streak' | 'personalBest' | 'habit' | 'work';
  achievementId: string;
  title: string;
  detail: string;
  value: number;
  achievedAt: string;
  note: string;
  createdAt: string;
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

  /* --------------------------------------------------------------- feed */

  /** Your posts and your friends', newest first. Your own are included. */
  feed: (token: string): Promise<ApiResult<{ feed: FeedPost[]; friendCount: number }>> =>
    request('/api/friends/feed', { token }),

  /** No audience to pick: a friend post goes to everybody you have added. */
  postToFriends: (
    token: string,
    body: {
      kind: FeedPost['kind'];
      achievementId: string;
      title: string;
      detail: string;
      value: number;
      achievedAt: string;
      note?: string;
    },
  ): Promise<ApiResult<{ share: FeedPost }>> =>
    request('/api/friends/shares', { method: 'POST', token, body }),

  /** Yours only. A friend feed has no moderator. */
  removePost: (token: string, shareId: string): Promise<ApiResult<unknown>> =>
    request(`/api/friends/shares/${shareId}`, { method: 'DELETE', token }),

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
