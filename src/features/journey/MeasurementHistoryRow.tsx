import { memo, useCallback } from 'react';
import { StyleSheet, Text } from 'react-native';

import { longDateLabel } from '../../lib/time';
import { MEASUREMENT_METRICS } from '../../state/journey/measurements';
import type { MeasurementEntry } from '../../state/journey/types';
import { palette, radius } from '../../theme/theme';
import { PressableScale } from '../../ui/Touchable';

/**
 * One dated reading in the history list.
 *
 * Summarised by how many fields it holds rather than by its values — a row
 * that tried to show eight numbers would be unreadable, and the charts above
 * already carry the numbers that matter.
 */
export const MeasurementHistoryRow = memo(function MeasurementHistoryRow({
  entry,
  onPress,
}: {
  entry: MeasurementEntry;
  onPress: (entry: MeasurementEntry) => void;
}) {
  const handlePress = useCallback(() => onPress(entry), [entry, onPress]);
  const filled = MEASUREMENT_METRICS.filter((m) => entry[m.key] !== null).length;

  return (
    <PressableScale
      onPress={handlePress}
      haptic="selection"
      scaleTo={0.98}
      accessibilityLabel={`Reading from ${longDateLabel(entry.date)}, ${filled} ${
        filled === 1 ? 'value' : 'values'
      }. Tap to edit.`}
      style={styles.row}
    >
      <Text style={styles.date}>{longDateLabel(entry.date)}</Text>
      <Text style={styles.count}>
        {filled} {filled === 1 ? 'value' : 'values'}
      </Text>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 13,
    borderRadius: radius.md,
    backgroundColor: palette.glassSunken,
  },
  date: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  count: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textFaint,
  },
});
