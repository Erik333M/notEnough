import { request, type ApiResult } from './client';
import type { RosterEntry, TeamRole } from './teams';

/**
 * Events — a camp, a training week, a competition weekend.
 *
 * An event is a team with dates, an age group and a ceiling, so everything
 * about membership still goes through the team routes: you join one with its
 * invite code, and the roster you get back is the roster type. Only the shape
 * of the occasion lives here.
 */

export type EventRow = {
  id: string;
  teamId: string;
  /** Inclusive, both of them. A camp that starts and ends today lasts a day. */
  startDate: string;
  endDate: string;
  /** A label, not a gate. The app holds no birthdates. */
  ageMin: number;
  ageMax: number;
  /** Campers. Staff are counted apart and take no place. */
  capacity: number;
  staffTarget: number;
  createdAt: string;
};

export type EventCounts = { campers: number; staff: number };

export type EventSummary = {
  event: EventRow;
  team: { id: string; name: string; notes: string; inviteCode: string; archived: boolean };
  counts: EventCounts;
  days: number;
  role: TeamRole;
};

export type EventDetail = EventSummary & { roster: RosterEntry[] };

export type EventInput = {
  name: string;
  notes?: string;
  startDate: string;
  endDate: string;
  ageMin: number;
  ageMax: number;
  capacity: number;
  staffTarget: number;
};

export const eventsApi = {
  list: (token: string): Promise<ApiResult<{ events: EventSummary[] }>> =>
    request('/api/events', { token }),

  /** Anybody can. You become its first staff member, and nothing else changes. */
  create: (token: string, input: EventInput): Promise<ApiResult<EventSummary>> =>
    request('/api/events', { method: 'POST', token, body: input }),

  detail: (token: string, eventId: string): Promise<ApiResult<EventDetail>> =>
    request(`/api/events/${eventId}`, { token }),

  /** Staff only. The whole shape is sent, so a partial edit cannot half-apply. */
  update: (token: string, eventId: string, input: EventInput): Promise<ApiResult<EventSummary>> =>
    request(`/api/events/${eventId}`, { method: 'PATCH', token, body: input }),

  /**
   * Make somebody staff, put them back, or admit them from the waiting list.
   *
   * Lives on the team path because that is what it changes — a membership.
   * Promoting to coach admits them too: staff never took a camper's place.
   */
  setMember: (
    token: string,
    teamId: string,
    userId: string,
    change: { role?: TeamRole; status?: 'active' | 'pending' },
  ): Promise<ApiResult<{ membership: { role: TeamRole; status: string } }>> =>
    request(`/api/teams/${teamId}/members/${userId}`, { method: 'PATCH', token, body: change }),
};
