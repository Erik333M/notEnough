import { memo } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { Share } from '../../api/teams';
import { palette } from '../../theme/theme';
import { SectionHeader } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';
import { TeamFeed } from './TeamFeed';

/**
 * The team's wall, and the sentence that explains it.
 *
 * The empty copy is doing real work: a reader cannot tell a deliberate feed
 * from an automatic one by looking at it, so it says outright that nothing
 * lands here because somebody trained.
 */
export const TeamWallSection = memo(function TeamWallSection({
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
  return (
    <>
      <SectionHeader
        title="Wall"
        meta={shares.length === 0 ? 'Nothing posted yet' : `${shares.length} shared by the team`}
      />

      {shares.length === 0 ? (
        <GlassCard style={styles.empty}>
          <Text style={styles.copy}>
            Achievements only appear here when somebody chooses to post one. Nothing lands on this
            wall because a person trained — find yours under Progress.
          </Text>
        </GlassCard>
      ) : (
        <TeamFeed
          shares={shares}
          currentUserId={currentUserId}
          isCoach={isCoach}
          onRemove={onRemove}
        />
      )}
    </>
  );
});

const styles = StyleSheet.create({
  empty: { paddingVertical: 14 },
  copy: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
});
