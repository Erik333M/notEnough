import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { WOD_ROUNDS, WOD_TAGS } from '../../state/journey/types';
import type { WodRounds, WodTag } from '../../state/journey/types';
import { palette, radius } from '../../theme/theme';
import { Chip } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';
import { InfoTip } from './InfoTip';

/**
 * The two tap-only cards at the top of the builder: what kind of training it
 * was, and how many rounds.
 *
 * Both are pure classification and neither is required. The M/G/W chips spell
 * out what each letter means rather than assuming the vocabulary, with the
 * fuller explanation one tap away.
 */
const TAG_LABEL: Record<WodTag, string> = {
  M: 'Cardio',
  G: 'Bodyweight',
  W: 'Lifting',
};

export const WodTagsCard = memo(function WodTagsCard({
  tags,
  onToggle,
}: {
  tags: WodTag[];
  onToggle: (tag: WodTag) => void;
}) {
  return (
    <GlassCard style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>WHAT KIND</Text>
        <InfoTip topic="energySystems" />
      </View>
      <Text style={styles.hint}>Optional. Tag as many as fit, or none.</Text>
      <View style={styles.chips}>
        {WOD_TAGS.map((tag) => (
          <Chip
            key={tag}
            label={`${tag} · ${TAG_LABEL[tag]}`}
            active={tags.includes(tag)}
            accent="cyan"
            onPress={() => onToggle(tag)}
          />
        ))}
      </View>
    </GlassCard>
  );
});

export const WodRoundsCard = memo(function WodRoundsCard({
  rounds,
  onSelect,
}: {
  rounds: WodRounds | null;
  onSelect: (rounds: WodRounds) => void;
}) {
  return (
    <GlassCard style={styles.card}>
      <Text style={styles.label}>ROUNDS</Text>
      <Text style={styles.hint}>Tap again to clear.</Text>
      <View style={styles.chips}>
        {WOD_ROUNDS.map((round) => (
          <Chip
            key={round}
            label={`${round}`}
            active={rounds === round}
            accent="violet"
            onPress={() => onSelect(round)}
          />
        ))}
      </View>
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: 10,
    borderRadius: radius.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  label: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: palette.textMuted,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: palette.textFaint,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
