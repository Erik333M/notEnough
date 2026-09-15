import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { teamsApi, type Team, type TeamRole } from '../api/teams';

/**
 * Which team features this account can currently use.
 *
 * Derived in one place from the memberships the server returns, so no
 * component ever asks "is this person a coach" for itself. A screen reads a
 * boolean; the reasoning behind it lives here.
 *
 * A solo user has no memberships, so every flag is false and the whole feature
 * stays invisible to them. That is the mechanism — not a setting they have to
 * find and turn off.
 */
export type Capabilities = {
  /** True while the first fetch is in flight, so nothing flickers into view. */
  loading: boolean;
  /** In at least one team, in any role. Controls the Teams entry point. */
  hasTeams: boolean;
  /** Coaches at least one team. Controls anything that hands out work. */
  isCoach: boolean;
  /** An athlete somewhere — they have work coming to them. */
  isAthlete: boolean;
};

type Membership = { team: Team; role: TeamRole };

type TeamsContextValue = {
  capabilities: Capabilities;
  memberships: Membership[];
  /** Null until a fetch has failed; holds the reason so screens can say it. */
  error: string | null;
  refresh: () => Promise<void>;
  createTeam: (name: string) => Promise<{ ok: true; team: Team } | { ok: false; message: string }>;
  joinTeam: (code: string) => Promise<{ ok: true; team: Team } | { ok: false; message: string }>;
};

const TeamsContext = createContext<TeamsContextValue | null>(null);

const NO_TEAMS: Capabilities = {
  loading: false,
  hasTeams: false,
  isCoach: false,
  isAthlete: false,
};

/**
 * Teams are fetched, not synced.
 *
 * Unlike the rest of the app, this data belongs to more than one person: a
 * coach can add you to a squad while your phone is in a locker, so a local
 * copy would be wrong the moment it was written. It is read on open and after
 * any change, and it is the one part of the app that needs a connection.
 */
export function TeamsProvider({
  token,
  children,
}: {
  token: string | null;
  children: React.ReactNode;
}) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!token) {
      setMemberships([]);
      setLoading(false);
      return;
    }

    const result = await teamsApi.mine(token);
    if (!mounted.current) return;

    if (result.ok) {
      setMemberships(result.data.teams);
      setError(null);
    } else {
      // Offline keeps whatever was last loaded rather than emptying the list:
      // a coach walking into a basement gym should not watch their squad
      // disappear. The error is surfaced, not the absence.
      setError(
        result.error.kind === 'offline'
          ? 'Cannot reach the server. Showing what was last loaded.'
          : result.error.message,
      );
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTeam = useCallback<TeamsContextValue['createTeam']>(
    async (name) => {
      if (!token) return { ok: false, message: 'You need to be online to create a team.' };
      const result = await teamsApi.create(token, name);
      if (!result.ok) return { ok: false, message: result.error.message };
      await refresh();
      return { ok: true, team: result.data.team };
    },
    [refresh, token],
  );

  const joinTeam = useCallback<TeamsContextValue['joinTeam']>(
    async (code) => {
      if (!token) return { ok: false, message: 'You need to be online to join a team.' };
      const result = await teamsApi.join(token, code.trim().toUpperCase());
      if (!result.ok) {
        return {
          ok: false,
          message:
            result.error.code === 'no_such_team'
              ? 'No team uses that code. Check it with your coach.'
              : result.error.message,
        };
      }
      await refresh();
      return { ok: true, team: result.data.team };
    },
    [refresh, token],
  );

  const capabilities = useMemo<Capabilities>(
    () => ({
      loading,
      hasTeams: memberships.length > 0,
      isCoach: memberships.some((row) => row.role === 'coach'),
      isAthlete: memberships.some((row) => row.role === 'athlete'),
    }),
    [loading, memberships],
  );

  const value = useMemo<TeamsContextValue>(
    () => ({ capabilities, memberships, error, refresh, createTeam, joinTeam }),
    [capabilities, memberships, error, refresh, createTeam, joinTeam],
  );

  return <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>;
}

function useTeamsContext(): TeamsContextValue | null {
  return useContext(TeamsContext);
}

/**
 * The single source for "may this person do team things".
 *
 * Safe to call anywhere, including outside the provider — it answers "no" —
 * so a shared component never has to know whether teams are in play.
 */
export function useCapabilities(): Capabilities {
  return useTeamsContext()?.capabilities ?? NO_TEAMS;
}

export function useTeams(): TeamsContextValue {
  const value = useTeamsContext();
  if (!value) throw new Error('useTeams must be used inside a TeamsProvider.');
  return value;
}
