import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ChallengeScope, ChallengeSummary } from '../../api/teams';
import { radius } from '../../theme/theme';
import { Pill } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';
import { ProgressBar } from '../../ui/Progress';
import { PressableScale } from '../../ui/Touchable';
import { elapsedFraction, isRunning } from './period';
import type { AccentName } from '../../theme/tokens';
import type { Theme } from '../../theme/tokens';
import { useStyles, useTheme } from '../../theme/ThemeContext';

/**
 * One challenge in a team's list.
 *
 * A challenge you have not joined shows what it is and nothing about you — no
 * greyed-out rank, no "you would be 6th". Until you opt in you are not in it,
 * and the row should not imply otherwise.
 */
const SCOPE: Record<ChallengeScope, { label: string; accent: AccentName }> = {
  daily: { label: 'Today', accent: 'body' },
  weekly: { label: 'This week', accent: 'mind' },
  monthly: { label: 'This month', accent: 'spirit' },
};

export const ChallengeRow = memo(function ChallengeRow({
  summary,
  localScore,
  today,
  onPress,
}: {
  summary: ChallengeSummary;
  /** Worked out on this device; the server copy may be a beat behind. */
  localScore: number;
  today: string;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const { challenge, joined, entrants } = summary;
  const scope = SCOPE[challenge.scope] ?? SCOPE.monthly;
  const tint = theme.accent[scope.accent];

  const score = joined ? Math.max(localScore, summary.myScore) : 0;
  const progress = challenge.target > 0 ? score / challenge.target : 0;
  const running = isRunning(challenge.periodStart, challenge.periodEnd, today);
  const elapsed = elapsedFraction(challenge.periodStart, challenge.periodEnd, today);

  // Said once, plainly, and only when it is true — a nag on every row would
  // make the whole list something to avoid opening.
  const behind = joined && running && elapsed > 0.25 && progress < elapsed - 0.15;

  return (
    <PressableScale haptic="light" onPress={onPress} accessibilityLabel={`Open ${challenge.title}`}>
      <GlassCard style={styles.card}>
        <View style={styles.head}>
          <Pill label={scope.label} accent={scope.accent} />
          {!running ? <Text style={styles.closed}>Finished</Text> : null}
          <View style={styles.spacer} />
          <Text style={styles.entrants}>
            {entrants === 0 ? 'Nobody yet' : `${entrants} in`}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={theme.textFaint} />
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {challenge.title}
        </Text>

        {joined ? (
          <>
            <View style={styles.scoreRow}>
              <Text style={[styles.score, { color: tint }]}>{score}</Text>
              <Text style={styles.target}>of {challenge.target}</Text>
              {behind ? <Text style={styles.behind}>behind the pace</Text> : null}
            </View>
            <ProgressBar progress={progress} accent={scope.accent} />
          </>
        ) : (
          <Text style={styles.invite}>
            {running ? 'Tap to see it and join in.' : 'Tap to see how it finished.'}
          </Text>
        )}

        {challenge.reward ? (
          <View style={styles.rewardRow}>
            <Ionicons name="gift-outline" size={13} color={theme.warning} />
            <Text style={styles.reward} numberOfLines={1}>
              {challenge.reward}
            </Text>
          </View>
        ) : null}
      </GlassCard>
    </PressableScale>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: { gap: 9, padding: 15 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spacer: { flex: 1 },
  closed: { fontSize: 11, fontWeight: '800', color: theme.textFaint },
  entrants: { fontSize: 11.5, fontWeight: '700', color: theme.textMuted },
  title: { fontSize: 15, fontWeight: '800', color: theme.text },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  score: { fontSize: 22, fontWeight: '800' },
  target: { fontSize: 12.5, fontWeight: '700', color: theme.textMuted },
  behind: { marginLeft: 'auto', fontSize: 11, fontWeight: '700', color: theme.warning },
  invite: { fontSize: 12.5, fontWeight: '600', color: theme.textMuted },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reward: { flex: 1, fontSize: 11.5, fontWeight: '700', color: theme.warning },
});
