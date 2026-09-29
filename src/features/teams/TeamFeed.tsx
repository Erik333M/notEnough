import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Share, ShareKind } from '../../api/teams';
import { longDateLabel } from '../../lib/time';
import type { IconName } from '../../state/types';
import { radius } from '../../theme/theme';
import { RoundIconButton } from '../../ui/Controls';
import type { AccentName } from '../../theme/tokens';
import type { Theme } from '../../theme/tokens';
import { useStyles, useTheme } from '../../theme/ThemeContext';

/**
 * What the team has chosen to show each other.
 *
 * Everything here was posted deliberately — nothing lands on this feed because
 * somebody trained. That is worth stating on the screen as well as in the
 * code, because a feed that filled itself would change what the whole app
 * means, and a reader cannot tell the difference by looking.
 *
 * No likes, no comments, no counts. A squad noticeboard, not a timeline: the
 * moment a post can be scored, training starts being done for the score.
 */
const LOOK: Record<ShareKind, { icon: IconName; accent: AccentName }> = {
  streak: { icon: 'flame', accent: 'warning' },
  personalBest: { icon: 'trophy', accent: 'spirit' },
  habit: { icon: 'repeat', accent: 'body' },
  work: { icon: 'checkmark-done', accent: 'mind' },
};

export const TeamFeed = memo(function TeamFeed({
  shares,
  currentUserId,
  isCoach,
  onRemove,
}: {
  shares: Share[];
  currentUserId: string | undefined;
  isCoach: boolean;
  onRemove: (share: Share) => void;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <View style={styles.list}>
      {shares.map((share) => {
        const look = LOOK[share.kind] ?? LOOK.work;
        const tint = theme.accent[look.accent];
        const mine = share.userId === currentUserId;

        return (
          <View key={share.id} style={styles.row}>
            <View style={[styles.icon, { backgroundColor: `${tint}26` }]}>
              <Ionicons name={look.icon} size={16} color={tint} />
            </View>

            <View style={styles.body}>
              <Text style={styles.author}>
                {share.authorName}
                {mine ? <Text style={styles.you}>  you</Text> : null}
              </Text>
              <Text style={styles.title}>{share.title}</Text>
              {share.detail ? <Text style={styles.detail}>{share.detail}</Text> : null}
              {share.note ? <Text style={styles.note}>“{share.note}”</Text> : null}
              <Text style={styles.date}>{longDateLabel(share.achievedAt)}</Text>
            </View>

            {/* The author, or a coach keeping the board tidy. Nobody else. */}
            {mine || isCoach ? (
              <RoundIconButton
                icon="close"
                size={32}
                onPress={() => onRemove(share)}
                accessibilityLabel={`Remove ${share.title}`}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
});

const makeStyles = (theme: Theme) => StyleSheet.create({
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: theme.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.border,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 3 },
  author: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.3, color: theme.textFaint },
  you: { fontSize: 10.5, fontWeight: '700', color: theme.textFaint },
  title: { fontSize: 14.5, fontWeight: '800', color: theme.text },
  detail: { fontSize: 12.5, fontWeight: '600', color: theme.textMuted },
  note: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: theme.text, fontStyle: 'italic' },
  date: { fontSize: 11, fontWeight: '700', color: theme.textFaint },
});
