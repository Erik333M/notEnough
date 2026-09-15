import { useCallback, useEffect, useRef, useState } from 'react';

import {
  teamsApi,
  type Assignment,
  type RosterEntry,
  type Session,
  type SessionTask,
  type Team,
  type TeamRole,
} from '../../api/teams';
import { useAuth } from '../../state/AuthContext';

/**
 * Reads for the team screens.
 *
 * Everything here is fetched rather than synced. This data belongs to more
 * than one person — a coach can hand out work while your phone is in a locker
 * — so a local copy is stale the moment it is written, and pretending
 * otherwise would show an athlete a session list that quietly disagreed with
 * their coach's.
 *
 * Each hook exposes `reload` so a screen can refresh after its own write
 * rather than guessing at what changed.
 */

type Async<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

function useAsync<T>(fetcher: ((token: string) => Promise<T | null>) | null): Async<T> {
  const { token } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!token || !fetcher) return;
    const result = await fetcher(token);
    if (!mounted.current) return;
    if (result === null) {
      // Null is the fetcher's own signal that the request failed; it has
      // already decided this is not data worth rendering.
      setError('Cannot load this right now. Pull to try again.');
    } else {
      setData(result);
      setError(null);
    }
    setLoading(false);
  }, [fetcher, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export type TeamDetail = {
  team: Team;
  role: TeamRole;
  roster: RosterEntry[];
  sessions: Session[];
  templates: Session[];
};

export function useTeamDetail(teamId: string): Async<TeamDetail> {
  const fetcher = useCallback(
    async (token: string): Promise<TeamDetail | null> => {
      // Three reads, one wait. The roster is useless without the sessions
      // beside it, so serialising them would only make the screen slower.
      const [detail, sessions, templates] = await Promise.all([
        teamsApi.detail(token, teamId),
        teamsApi.sessions(token, teamId, false),
        teamsApi.sessions(token, teamId, true),
      ]);
      if (!detail.ok || !sessions.ok || !templates.ok) return null;
      return {
        team: detail.data.team,
        role: detail.data.role,
        roster: detail.data.roster,
        sessions: sessions.data.sessions,
        templates: templates.data.sessions,
      };
    },
    [teamId],
  );

  return useAsync(fetcher);
}

export type SessionDetail = {
  session: Session;
  tasks: SessionTask[];
  assignments: Assignment[];
  role: TeamRole;
  /** Names for the ids on the assignments, so the grid can be read. */
  roster: RosterEntry[];
};

export function useSessionDetail(teamId: string, sessionId: string): Async<SessionDetail> {
  const fetcher = useCallback(
    async (token: string): Promise<SessionDetail | null> => {
      const [session, team] = await Promise.all([
        teamsApi.session(token, sessionId),
        teamsApi.detail(token, teamId),
      ]);
      if (!session.ok) return null;
      return {
        ...session.data,
        // An athlete can read the roster too, so a shared board can show names
        // rather than ids. If that read fails the screen still works, with the
        // athlete's own row named by the assignment it belongs to.
        roster: team.ok ? team.data.roster : [],
      };
    },
    [sessionId, teamId],
  );

  return useAsync(fetcher);
}

/** Progress across one athlete's rows in a session. */
export function tally(assignments: Assignment[]): { done: number; total: number } {
  return {
    done: assignments.filter((row) => row.result?.done).length,
    total: assignments.length,
  };
}

export function nameFor(roster: RosterEntry[], userId: string): string {
  return roster.find((row) => row.userId === userId)?.name ?? 'Athlete';
}
