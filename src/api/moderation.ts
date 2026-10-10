import { request, type ApiResult } from './client';

/**
 * Blocking and reporting.
 *
 * Blocking is the one that matters: it needs nobody's agreement and takes
 * effect the moment it is pressed. Reporting records what a filter and a
 * block cannot settle between them.
 */

export type BlockedPerson = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
};

export type ReportKind = 'message' | 'post' | 'person';

export type ReportReason =
  | 'abuse'
  | 'harassment'
  | 'spam'
  | 'sexual'
  | 'violence'
  | 'impersonation'
  | 'other';

/** The wording people see. Kept here so every surface offers the same list. */
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  abuse: 'Abusive or hateful',
  harassment: 'Harassment or bullying',
  spam: 'Spam',
  sexual: 'Sexual content',
  violence: 'Violence or threats',
  impersonation: 'Pretending to be someone else',
  other: 'Something else',
};

export const moderationApi = {
  blocks: (token: string): Promise<ApiResult<{ blocks: BlockedPerson[] }>> =>
    request('/api/moderation/blocks', { token }),

  /** Two-directional and immediate. Nothing either of you recorded is deleted. */
  block: (token: string, userId: string): Promise<ApiResult<{ ok: true }>> =>
    request('/api/moderation/blocks', { method: 'POST', token, body: { userId } }),

  unblock: (token: string, userId: string): Promise<ApiResult<unknown>> =>
    request(`/api/moderation/blocks/${userId}`, { method: 'DELETE', token }),

  /**
   * Report, and block by default.
   *
   * Somebody who has just seen something worth reporting almost never wants
   * to keep seeing that person while it is looked at, and making them press
   * twice is a worse experience at the worst moment.
   */
  report: (
    token: string,
    body: {
      kind: ReportKind;
      targetUserId: string;
      targetId?: string;
      reason: ReportReason;
      note?: string;
      block?: boolean;
    },
  ): Promise<ApiResult<{ report: { id: string }; blocked: boolean }>> =>
    request('/api/moderation/reports', { method: 'POST', token, body }),
};
