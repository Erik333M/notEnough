import { request, type ApiResult } from './client';

/**
 * The event channel.
 *
 * Staff post, everybody at the event reads. Posting and history go over HTTP
 * because that is what makes a message durable; the socket in `useChat` only
 * saves everybody a refresh, so losing it costs liveness and nothing else.
 */

export type ChatMessage = {
  id: string;
  eventId: string;
  userId: string;
  /** Carried on the message so a deleted account's posts still read as somebody. */
  name: string;
  avatarUrl: string | null;
  body: string;
  createdAt: string;
};

type Page = { messages: ChatMessage[]; hasMore: boolean; canPost: boolean };

export const chatApi = {
  /**
   * One page, oldest first. `before` is a message id, not a time: two messages
   * in the same millisecond would make a timestamp cursor skip or repeat one.
   */
  history: (token: string, eventId: string, before?: string): Promise<ApiResult<Page>> =>
    request(`/api/events/${eventId}/messages${before ? `?before=${before}` : ''}`, { token }),

  post: (token: string, eventId: string, body: string): Promise<ApiResult<{ message: ChatMessage }>> =>
    request(`/api/events/${eventId}/messages`, { method: 'POST', token, body: { body } }),

  remove: (token: string, eventId: string, messageId: string): Promise<ApiResult<unknown>> =>
    request(`/api/events/${eventId}/messages/${messageId}`, { method: 'DELETE', token }),
};
