import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ChallengeSummary } from '../../api/teams';
import { palette } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { SectionHeader } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';
import { ChallengeRow } from './ChallengeRow';

/**
 * The challenges running for one team.
 *
 * Its own component because a team screen that inlines every section becomes a
 * file nobody can scan. The empty state differs by role: a coach is told what
 * a challenge is and invited to set one; an athlete is told none is running
 * and — importantly — that joining will be their choice when one is.
 */
export const TeamChallengesSection = memo(function TeamChallengesSection({
  summaries,
  localScores,
  today,
  isCoach,
  onOpen,
  onCreate,
}: {
  summaries: ChallengeSummary[];
  localScores: Map<string, number>;
  today: string;
  isCoach: boolean;
  onOpen: (challengeId: string) => void;
  onCreate: () => void;
}) {
  return (
    <>
      <SectionHeader
        title="Challenges"
        meta={
          summaries.length === 0
            ? isCoach
              ? 'Set one for the squad'
              : 'None running'
            : 'Scored from 3 Victories'
        }
      />

      {summaries.length === 0 ? (
        <GlassCard style={styles.empty}>
          <Text style={styles.copy}>
            {isCoach
              ? 'A challenge counts the victories your squad wins over a day, a week or a month. Nobody is entered automatically.'
              : 'Nothing running yet. When your coach sets one, joining will be up to you.'}
          </Text>
        </GlassCard>
      ) : (
        <View style={styles.list}>
          {summaries.map((summary) => (
            <ChallengeRow
              key={summary.challenge.id}
              summary={summary}
              localScore={localScores.get(summary.challenge.id) ?? 0}
              today={today}
              onPress={() => onOpen(summary.challenge.id)}
            />
          ))}
        </View>
      )}

      {isCoach ? (
        <View style={styles.actions}>
          <Button label="New challenge" icon="flag-outline" variant="glass" onPress={onCreate} />
        </View>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  empty: { paddingVertical: 14 },
  copy: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
  list: { gap: 10 },
  actions: { marginTop: 10 },
});
