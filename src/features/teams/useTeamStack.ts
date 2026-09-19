import { useCallback, useMemo, useReducer } from 'react';

/**
 * Navigation inside the Teams tab.
 *
 * The same shape as the Journey tab's stack, and for the same reason: the
 * app shell is a flat route switch with no params, which cannot express "the
 * roster for this team" or "Tuesday's session" — nor a back path out of them.
 * The shell sees one `teams` route; everything below it is this.
 *
 * Views carry their params in the union, so a screen cannot be pushed without
 * the id it needs.
 */
export type TeamView =
  | { key: 'list' }
  | { key: 'team'; teamId: string }
  | { key: 'session'; teamId: string; sessionId: string }
  | { key: 'visibility'; teamId: string; teamName: string }
  | { key: 'challenge'; teamId: string; challengeId: string }
  | { key: 'event'; eventId: string };

type Action = { type: 'push'; view: TeamView } | { type: 'pop' } | { type: 'reset' };

/** Root is always present, so `at(-1)` is never undefined. */
type Stack = [TeamView, ...TeamView[]];

const ROOT: TeamView = { key: 'list' };

function reducer(stack: Stack, action: Action): Stack {
  switch (action.type) {
    case 'push':
      return [...stack, action.view];

    case 'pop':
      // Never pops the root: the tab must always render something.
      return stack.length > 1 ? (stack.slice(0, -1) as Stack) : stack;

    case 'reset':
      return stack.length === 1 ? stack : [ROOT];

    default:
      return stack;
  }
}

export type TeamNav = {
  view: TeamView;
  canGoBack: boolean;
  openTeam: (teamId: string) => void;
  openSession: (teamId: string, sessionId: string) => void;
  openVisibility: (teamId: string, teamName: string) => void;
  openChallenge: (teamId: string, challengeId: string) => void;
  openEvent: (eventId: string) => void;
  back: () => void;
  reset: () => void;
};

export function useTeamStack(): TeamNav {
  const [stack, dispatch] = useReducer(reducer, [ROOT] as Stack);

  const openTeam = useCallback(
    (teamId: string) => dispatch({ type: 'push', view: { key: 'team', teamId } }),
    [],
  );
  const openSession = useCallback(
    (teamId: string, sessionId: string) =>
      dispatch({ type: 'push', view: { key: 'session', teamId, sessionId } }),
    [],
  );
  const openVisibility = useCallback(
    (teamId: string, teamName: string) =>
      dispatch({ type: 'push', view: { key: 'visibility', teamId, teamName } }),
    [],
  );
  const openChallenge = useCallback(
    (teamId: string, challengeId: string) =>
      dispatch({ type: 'push', view: { key: 'challenge', teamId, challengeId } }),
    [],
  );
  const openEvent = useCallback(
    (eventId: string) => dispatch({ type: 'push', view: { key: 'event', eventId } }),
    [],
  );
  const back = useCallback(() => dispatch({ type: 'pop' }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  return useMemo(
    () => ({
      view: stack[stack.length - 1],
      canGoBack: stack.length > 1,
      openTeam,
      openSession,
      openVisibility,
      openChallenge,
      openEvent,
      back,
      reset,
    }),
    [stack, openTeam, openSession, openVisibility, openChallenge, openEvent, back, reset],
  );
}
