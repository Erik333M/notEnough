import { useEffect } from 'react';
import { BackHandler } from 'react-native';

import { useTeamStack } from '../features/teams/useTeamStack';
import SessionScreen from './SessionScreen';
import TeamDetailScreen from './TeamDetailScreen';
import TeamsListScreen from './TeamsListScreen';

/**
 * The single route the app shell knows about for teams.
 *
 * Everything inside the feature is addressed by its own typed stack, the same
 * arrangement the Journey tab uses: drill-downs carry the ids they need, which
 * the shell's flat `RouteKey` union cannot express.
 */
export default function TeamsScreen({
  bottomInset,
  initialAction,
}: {
  bottomInset: number;
  initialAction?: 'join' | 'create';
}) {
  const nav = useTeamStack();

  // Android's hardware back pops this stack before it leaves the app, so a
  // drill-down is never a one-way trip.
  useEffect(() => {
    if (!nav.canGoBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      nav.back();
      return true;
    });
    return () => sub.remove();
  }, [nav]);

  if (nav.view.key === 'team') {
    const { teamId } = nav.view;
    return (
      <TeamDetailScreen
        teamId={teamId}
        bottomInset={bottomInset}
        onBack={nav.back}
        onOpenSession={(sessionId) => nav.openSession(teamId, sessionId)}
      />
    );
  }

  if (nav.view.key === 'session') {
    return (
      <SessionScreen
        teamId={nav.view.teamId}
        sessionId={nav.view.sessionId}
        bottomInset={bottomInset}
        onBack={nav.back}
      />
    );
  }

  return (
    <TeamsListScreen
      bottomInset={bottomInset}
      initialAction={initialAction}
      onOpenTeam={nav.openTeam}
    />
  );
}
