import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MOVEMENT_CATEGORY_LABEL } from '../../state/journey/movements';
import type { Movement } from '../../state/journey/types';
import { accentColor, palette, radius } from '../../theme/theme';
import { PressableScale } from '../../ui/Touchable';

/** One catalogue result inside the picker sheet. */
export const MovementResultRow = memo(function MovementResultRow({
  movement,
  onPick,
}: {
  movement: Movement;
  onPick: (movement: Movement) => void;
}) {
  const handlePress = useCallback(() => onPick(movement), [movement, onPick]);

  return (
    <PressableScale
      onPress={handlePress}
      haptic="selection"
      scaleTo={0.98}
      accessibilityLabel={`${movement.name}, ${MOVEMENT_CATEGORY_LABEL[movement.category]}`}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {movement.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {MOVEMENT_CATEGORY_LABEL[movement.category]}
          {movement.isCustom ? ' • yours' : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
    </PressableScale>
  );
});

/**
 * The escape hatch shown when a search matches nothing.
 *
 * Two ways out, because they are genuinely different intentions: add it to the
 * catalogue for next time, or use it once and never see it again. Offering
 * only the first would slowly fill someone's library with typos and one-offs.
 */
export const NoMatchActions = memo(function NoMatchActions({
  query,
  onCreate,
  onUseOnce,
}: {
  query: string;
  onCreate: () => void;
  onUseOnce: () => void;
}) {
  return (
    <View style={styles.createRow}>
      <PressableScale
        onPress={onCreate}
        haptic="medium"
        scaleTo={0.98}
        accessibilityLabel={`Add ${query} to your movements`}
        style={styles.create}
      >
        <Ionicons name="add-circle" size={18} color={accentColor.lime} />
        <Text style={styles.createText} numberOfLines={1}>
          Add “{query}” to your movements
        </Text>
      </PressableScale>

      <PressableScale
        onPress={onUseOnce}
        haptic="light"
        scaleTo={0.98}
        accessibilityLabel={`Use ${query} just this once`}
        style={styles.once}
      >
        <Text style={styles.onceText}>Just this once</Text>
      </PressableScale>
    </View>
  );
});

/** Footer link out to the full library screen. */
export const BrowseAllRow = memo(function BrowseAllRow({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="light"
      scaleTo={0.98}
      accessibilityLabel="Browse the full movements library"
      style={styles.browse}
    >
      <Ionicons name="library-outline" size={16} color={palette.textMuted} />
      <Text style={styles.browseText}>Browse the full library</Text>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingVertical: 8,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
  },
  rowMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textFaint,
    marginTop: 2,
  },
  createRow: {
    gap: 8,
  },
  create: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 44,
    paddingHorizontal: 13,
    borderRadius: radius.md,
    backgroundColor: 'rgba(184,242,124,0.12)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(184,242,124,0.32)',
  },
  createText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: accentColor.lime,
  },
  once: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  onceText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.textMuted,
  },
  browse: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    marginTop: 4,
    borderRadius: radius.md,
    backgroundColor: palette.glassSunken,
  },
  browseText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.textMuted,
  },
});
