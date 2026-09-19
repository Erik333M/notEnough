import { request, type ApiResult } from './client';

/**
 * Statistics an event keeps.
 *
 * Split from events.ts on length, but it is also a real seam: everything here
 * is about numbers the organiser chose to collect, and nothing about it knows
 * what a camp is.
 */
/**
 * One thing this event counts.
 *
 * Defined by the organiser, not shipped with the app. `scope` is the only
 * structure imposed on it, and it is what makes a standings table and a top
 * scorer list possible from the same recorded numbers.
 */
export type StatField = {
  id: string;
  eventId: string;
  label: string;
  scope: 'team' | 'player';
  /** Exactly one per event. Renameable, never removable. */
  isScore: boolean;
  order: number;
};

export type StatEntry = {
  teamId: string;
  /** Null for a team total. */
  userId: string | null;
  fieldId: string;
  value: number;
};

export type Game = {
  id: string;
  eventId: string;
  title: string;
  homeTeamId: string;
  awayTeamId: string;
  playedOn: string;
  /** Scheduled until somebody records a result; not a nil-nil draw before. */
  status: 'scheduled' | 'played';
  stats: StatEntry[];
};

export type StandingsRow = {
  teamId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  for: number;
  against: number;
  difference: number;
  points: number;
};

export type Leaderboard = {
  field: StatField;
  rows: { userId: string; name: string; value: number }[];
};

export type GamesView = {
  games: Game[];
  fields: StatField[];
  standings: StandingsRow[];
  leaders: Leaderboard[];
  canManage: boolean;
};

export const statsApi = {
  /** Fixtures, the table and the leaderboards in one read: one screen shows all three. */
  games: (token: string, eventId: string): Promise<ApiResult<GamesView>> =>
    request(`/api/events/${eventId}/games`, { token }),

  addField: (
    token: string,
    eventId: string,
    label: string,
    scope: 'team' | 'player',
  ): Promise<ApiResult<{ field: StatField }>> =>
    request(`/api/events/${eventId}/fields`, { method: 'POST', token, body: { label, scope } }),

  /** Rename, reorder, or stop counting it. The result field refuses `archived`. */
  updateField: (
    token: string,
    eventId: string,
    fieldId: string,
    change: { label?: string; order?: number; archived?: boolean },
  ): Promise<ApiResult<{ field: StatField }>> =>
    request(`/api/events/${eventId}/fields/${fieldId}`, { method: 'PATCH', token, body: change }),

  addGame: (
    token: string,
    eventId: string,
    game: { homeTeamId: string; awayTeamId: string; playedOn: string; title?: string },
  ): Promise<ApiResult<{ game: Game }>> =>
    request(`/api/events/${eventId}/games`, { method: 'POST', token, body: game }),

  /** The whole game's numbers at once — entering a result is one act. */
  saveStats: (
    token: string,
    eventId: string,
    gameId: string,
    entries: StatEntry[],
    status: 'played' | 'scheduled' = 'played',
  ): Promise<ApiResult<{ game: Game }>> =>
    request(`/api/events/${eventId}/games/${gameId}/stats`, {
      method: 'PUT',
      token,
      body: { entries, status },
    }),

  removeGame: (token: string, eventId: string, gameId: string): Promise<ApiResult<unknown>> =>
    request(`/api/events/${eventId}/games/${gameId}`, { method: 'DELETE', token }),
};
