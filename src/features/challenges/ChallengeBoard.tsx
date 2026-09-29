import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ChallengeEntry } from '../../api/teams';
import { radius } from '../../theme/theme';
import { GlassCard } from '../../ui/Glass';
import { ProgressBar } from '../../ui/Progress';
import type { Theme } from '../../theme/tokens';
import { useStyles, useTheme } from '../../theme/ThemeContext';

/**
 * Where everyone stands.
 *
 * Only people who joined appear. Somebody who has not is absent rather than
 * last: a ranking you did not enter is not one you are losing, and listing
 * them at the bottom would make joining the only way to stop looking bad,
 * which is not a choice.
 *
 * Equal scores share a place. Breaking a tie by who submitted first would be
 * the app inventing a difference the training did not produce.
 */
export const ChallengeBoard = memo(function ChallengeBoard({
  entries,
  target,
  currentUserId,
}: {
  entries: ChallengeEntry[];
  target: number;
  currentUserId: string | undefined;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  if (entries.length === 0) {
    return (
      <GlassCard style={styles.empty}>
        <Text style={styles.emptyCopy}>
          Only people who join appear here. Nobody is entered automatically.
        </Text>
      </GlassCard>
    );
  }

  return (
    <View style={styles.board}>
      {entries.map((entry) => {
        const mine = entry.userId === currentUserId;
        const share = target > 0 ? entry.score / target : 0;

        return (
          <View key={entry.id} style={[styles.row, mine && styles.rowMine]}>
            <Text style={[styles.rank, entry.rank === 1 && styles.rankTop]}>{entry.rank}</Text>
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={1}>
                {entry.name}
                {mine ? <Text style={styles.you}>  you</Text> : null}
              </Text>
              <ProgressBar progress={share} accent={mine ? 'mind' : 'spirit'} height={5} />
            </View>
            <Text style={styles.score}>{entry.score}</Text>
          </View>
        );
      })}
    </View>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  empty: { paddingVertical: 16 },
  emptyCopy: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: theme.textMuted },
  board: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: theme.surface,
  },
  rowMine: { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: theme.accentSoft.mind },
  rank: { width: 22, fontSize: 14, fontWeight: '800', color: theme.textFaint, textAlign: 'center' },
  rankTop: { color: theme.accent.warning },
  body: { flex: 1, gap: 6 },
  name: { fontSize: 13.5, fontWeight: '700', color: theme.text },
  you: { fontSize: 11, fontWeight: '700', color: theme.textFaint },
  score: { fontSize: 16, fontWeight: '800', color: theme.text },
});
