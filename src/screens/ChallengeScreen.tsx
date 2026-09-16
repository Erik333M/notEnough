import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { teamsApi, type ChallengeDetail } from '../api/teams';
import { ChallengeBoard } from '../features/challenges/ChallengeBoard';
import { dayCount, elapsedFraction, isRunning } from '../features/challenges/period';
import { scoreFor } from '../features/challenges/useChallenges';
import { dayKey, longDateLabel } from '../lib/time';
import { useAppState } from '../state/DataContext';
import { useAuth } from '../state/AuthContext';
import { palette } from '../theme/theme';
import { Button } from '../ui/Button';
import { Appear, SectionHeader } from '../ui/Controls';
import { SkeletonCard } from '../ui/Feedback';
import { GlassCard } from '../ui/Glass';
import { StackHeaderBar } from '../ui/StackHeaderBar';
import { useToast } from '../ui/Toast';

/**
 * One challenge, and where everyone stands in it.
 *
 * The board only ever holds people who joined. Somebody who has not is absent
 * rather than last — a ranking you did not enter is not a ranking you are
 * losing, and showing them at the bottom would make opting in the only way to
 * stop looking bad, which is not a choice.
 */
export default function ChallengeScreen({
  challengeId,
  bottomInset,
  onBack,
}: {
  challengeId: string;
  bottomInset: number;
  onBack: () => void;
}) {
  const { token, user } = useAuth();
  const state = useAppState();
  const { notify } = useToast();

  const [data, setData] = useState<ChallengeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const result = await teamsApi.challenge(token, challengeId);
    if (result.ok) setData(result.data);
    setLoading(false);
  }, [challengeId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const joined = data?.entries.some((row) => row.userId === user?.id) ?? false;

  const join = useCallback(async () => {
    if (!token || !data || !state) return;
    setBusy(true);
    const result = await teamsApi.joinChallenge(token, challengeId);
    if (result.ok) {
      // Report what you have already done in the window straight away — joining
      // on the 20th should not put you on zero for the month.
      const score = scoreFor(
        state.victories.log,
        data.challenge.periodStart,
        data.challenge.periodEnd,
      );
      await teamsApi.reportScore(token, challengeId, score);
      await load();
      notify('You are in. Only your total is shared.', 'success');
    } else {
      notify(result.error.message, 'error');
    }
    setBusy(false);
  }, [challengeId, data, load, notify, state, token]);

  const leave = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    await teamsApi.leaveChallenge(token, challengeId);
    await load();
    setBusy(false);
    notify('You left. Your score went with you.', 'success');
  }, [challengeId, load, notify, token]);

  const close = useCallback(async () => {
    if (!token) return;
    await teamsApi.closeChallenge(token, challengeId);
    await load();
    notify('Challenge closed. The result stays readable.', 'success');
  }, [challengeId, load, notify, token]);

  const today = dayKey();
  const challenge = data?.challenge;
  const running = challenge ? isRunning(challenge.periodStart, challenge.periodEnd, today) : false;
  const days = challenge ? dayCount(challenge.periodStart, challenge.periodEnd) : 0;
  const elapsed = challenge
    ? Math.round(elapsedFraction(challenge.periodStart, challenge.periodEnd, today) * 100)
    : 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={palette.textMuted}
        />
      }
    >
      <StackHeaderBar
        title={challenge?.title ?? 'Challenge'}
        meta={
          challenge
            ? `${longDateLabel(challenge.periodStart)} · ${days} day${days === 1 ? '' : 's'}`
            : undefined
        }
        onBack={onBack}
        backLabel="Back to the team"
      />

      {loading ? <SkeletonCard /> : null}

      {challenge ? (
        <>
          <Appear>
            <GlassCard style={styles.hero}>
              <Text style={styles.heroLabel}>
                {running ? `${elapsed}% of the window gone` : 'Finished'}
              </Text>
              <Text style={styles.heroTitle}>
                Win {challenge.target} victories
              </Text>
              <Text style={styles.heroCopy}>
                Scored from 3 Victories — up to three a day, across{' '}
                {days === 1 ? 'today' : `${days} days`}. Your total is all anyone sees.
              </Text>

              {challenge.reward ? (
                <View style={styles.rewardRow}>
                  <Ionicons name="gift-outline" size={15} color={palette.amber} />
                  <Text style={styles.reward}>{challenge.reward}</Text>
                </View>
              ) : null}

              {joined ? (
                <Button
                  label="Leave the challenge"
                  icon="exit-outline"
                  variant="ghost"
                  loading={busy}
                  onPress={leave}
                />
              ) : running ? (
                <Button label="Join in" icon="flag" loading={busy} onPress={join} />
              ) : null}
            </GlassCard>
          </Appear>

          <Appear delay={60}>
            <SectionHeader
              title="Standings"
              meta={
                data.entries.length === 0
                  ? 'Nobody has joined yet'
                  : `${data.entries.length} taking part`
              }
            />
            <ChallengeBoard
              entries={data.entries}
              target={challenge.target}
              currentUserId={user?.id}
            />
          </Appear>

          {data.role === 'coach' && running ? (
            <Appear delay={120}>
              <GlassCard style={styles.coachCard}>
                <Text style={styles.coachTitle}>Closing it</Text>
                <Text style={styles.coachCopy}>
                  Closing stops new scores and takes it off the list. The standings stay readable,
                  so you can still see who won.
                </Text>
                <Button label="Close this challenge" icon="lock-closed-outline" variant="glass" onPress={close} />
              </GlassCard>
            </Appear>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 16 },
  hero: { gap: 10 },
  heroLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: palette.textFaint },
  heroTitle: { fontSize: 22, fontWeight: '800', color: palette.text },
  heroCopy: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  reward: { flex: 1, fontSize: 13, fontWeight: '700', color: palette.amber },
  coachCard: { gap: 10 },
  coachTitle: { fontSize: 14, fontWeight: '800', color: palette.text },
  coachCopy: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
});
