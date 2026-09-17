import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { teamsApi } from '../api/teams';
import { useTeammateFriends } from '../features/friends/useTeammateFriends';
import { InviteCard } from '../features/teams/InviteCard';
import { NewSessionSheet } from '../features/teams/NewSessionSheet';
import { TeamRosterSection } from '../features/teams/TeamRosterSection';
import { NewChallengeSheet } from '../features/challenges/NewChallengeSheet';
import { TeamChallengesSection } from '../features/challenges/TeamChallengesSection';
import { useChallenges } from '../features/challenges/useChallenges';
import { TeamFooter } from '../features/teams/TeamFooter';
import { TeamSessionsSection } from '../features/teams/TeamSessionsSection';
import { TeamWallSection } from '../features/teams/TeamWallSection';
import { useTeamDetail } from '../features/teams/useTeamData';
import { useAuth } from '../state/AuthContext';
import { useTeams } from '../state/TeamsContext';
import { palette, radius } from '../theme/theme';
import { Button } from '../ui/Button';
import { Appear } from '../ui/Controls';
import { SkeletonCard } from '../ui/Feedback';
import { GlassCard } from '../ui/Glass';
import { StackHeaderBar } from '../ui/StackHeaderBar';
import { useToast } from '../ui/Toast';

/**
 * One team: who is in it, and what has been set.
 *
 * The same screen for both sides of the roster. A coach gets the invite code
 * and the means to create a session; an athlete gets the list of what they
 * have been given. Splitting these into two screens would mean somebody who
 * coaches one squad and trains in another has to remember which is which.
 */
export default function TeamDetailScreen({
  teamId,
  bottomInset,
  onBack,
  onOpenSession,
  onOpenVisibility,
  onOpenChallenge,
}: {
  teamId: string;
  bottomInset: number;
  onBack: () => void;
  onOpenSession: (sessionId: string) => void;
  onOpenVisibility: (teamName: string) => void;
  onOpenChallenge: (challengeId: string) => void;
}) {
  const { token, user } = useAuth();
  const { refresh: refreshTeams } = useTeams();
  const { data, loading, error, reload } = useTeamDetail(teamId);
  const { notify } = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [settingChallenge, setSettingChallenge] = useState(false);
  const challenges = useChallenges(teamId);
  const { friendStateFor, addTeammate } = useTeammateFriends();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const handleCreate = useCallback(
    async (name: string, date: string) => {
      if (!token) return;
      const result = await teamsApi.createSession(token, teamId, { name, date });
      if (!result.ok) {
        notify(result.error.message, 'error');
        return;
      }
      setComposing(false);
      await reload();
      // Straight into the new session: an empty one is not useful until it has
      // tasks, so landing on it is the next thing you were going to do anyway.
      onOpenSession(result.data.session.id);
    },
    [notify, onOpenSession, reload, teamId, token],
  );

  const handleRemoveShare = useCallback(
    async (shareId: string) => {
      if (!token) return;
      const result = await teamsApi.removeShare(token, teamId, shareId);
      if (!result.ok) {
        notify(result.error.message, 'error');
        return;
      }
      await reload();
    },
    [notify, reload, teamId, token],
  );

  const handleLeave = useCallback(async () => {
    if (!token || !user) return;
    // Identified by id, never by role: matching on role would pick the first
    // person who happens to share yours and remove them instead of you.
    const result = await teamsApi.removeMember(token, teamId, user.id);
    if (!result.ok) {
      notify(
        result.error.code === 'validation_error'
          ? 'A team needs a coach. Make someone else one first.'
          : result.error.message,
        'error',
      );
      return;
    }
    notify('You left the team. Everything you logged is still yours.', 'success');
    await refreshTeams();
    onBack();
  }, [notify, onBack, refreshTeams, teamId, token, user]);

  const isCoach = data?.role === 'coach';

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={palette.textMuted} />
      }
    >
      <StackHeaderBar
        title={data?.team.name ?? 'Team'}
        meta={isCoach ? 'You coach this team' : 'You train with this team'}
        onBack={onBack}
        backLabel="Back to your teams"
      />

      {loading ? <SkeletonCard /> : null}

      {error ? (
        <View style={styles.notice}>
          <Ionicons name="cloud-offline-outline" size={15} color={palette.amber} />
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      ) : null}

      {data ? (
        <>
          {isCoach ? (
            <Appear>
              <InviteCard code={data.team.inviteCode} />
            </Appear>
          ) : null}

          <Appear delay={60}>
            <TeamSessionsSection
              sessions={data.sessions}
              isCoach={isCoach}
              onOpen={onOpenSession}
              onCreate={() => setComposing(true)}
            />
          </Appear>

          <Appear delay={90}>
            <TeamChallengesSection
              summaries={challenges.summaries}
              localScores={challenges.localScores}
              today={challenges.today}
              isCoach={isCoach}
              onOpen={onOpenChallenge}
              onCreate={() => setSettingChallenge(true)}
            />
          </Appear>

          <Appear delay={110}>
            <TeamWallSection
              shares={data.shares}
              currentUserId={user?.id}
              isCoach={isCoach}
              onRemove={(share) => void handleRemoveShare(share.id)}
            />
          </Appear>
          <Appear delay={120}>
            <TeamRosterSection
              roster={data.roster}
              currentUserId={user?.id}
              friendStateFor={friendStateFor}
              onAddFriend={(id, name) => void addTeammate(id, name)}
            />
          </Appear>

          <TeamFooter
            teamName={data.team.name}
            isCoach={isCoach}
            onOpenVisibility={onOpenVisibility}
            onLeave={handleLeave}
          />
        </>
      ) : null}

      <NewChallengeSheet
        open={settingChallenge}
        onClose={() => setSettingChallenge(false)}
        onCreate={async (input) => {
          if (!token) return false;
          const result = await teamsApi.createChallenge(token, teamId, input);
          if (!result.ok) {
            notify(result.error.message, 'error');
            return false;
          }
          await challenges.reload();
          return true;
        }}
      />

      <NewSessionSheet
        open={composing}
        onClose={() => setComposing(false)}
        onCreate={handleCreate}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 16 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,183,77,0.10)',
  },
  noticeText: { flex: 1, fontSize: 12, fontWeight: '600', color: palette.amber },
  list: { gap: 10 },
  actions: { marginTop: 10 },
});
