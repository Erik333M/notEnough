import { API_BASE_URL, request, type ApiResult } from './client';

/**
 * Profile pictures.
 *
 * Three calls, all of them about your own. There is deliberately no call that
 * takes somebody else's id — a friend's picture arrives inside their published
 * profile, through the same door as their name, so there is no second place
 * where visibility could be decided differently.
 */

/**
 * The server answers with a path, not a URL.
 *
 * It has to: the API host is whatever the phone can reach, resolved at launch
 * from Metro's own address. A stored absolute URL would be correct on the
 * machine that wrote it and wrong on every other one.
 */
export function avatarSource(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${API_BASE_URL}${path}`;
}

export const avatarsApi = {
  /** Your own, so a screen knows whether to draw a face or your initials. */
  mine: (token: string): Promise<ApiResult<{ avatarUrl: string | null }>> =>
    request('/api/avatars/me', { token }),

  /**
   * Base64, no data-URI prefix needed either way.
   *
   * Given a longer window than the default: a phone on a slow upstream can
   * take a while to push a few hundred kilobytes, and timing out on a picture
   * that was nearly there is a worse failure than waiting.
   */
  upload: (token: string, image: string): Promise<ApiResult<{ avatarUrl: string }>> =>
    request('/api/avatars/me', { method: 'PUT', token, body: { image }, timeoutMs: 30000 }),

  remove: (token: string): Promise<ApiResult<Record<string, never>>> =>
    request('/api/avatars/me', { method: 'DELETE', token }),
};
