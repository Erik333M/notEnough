import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  BENCHMARK_METRIC_LABEL,
  formatBenchmarkValue,
} from '../../state/journey/benchmarks';
import type {
  BenchmarkDefinition,
  BenchmarkResult,
  UnitSystem,
} from '../../state/journey/types';
import { accentColor, palette, radius } from '../../theme/theme';
import { PressableScale } from '../../ui/Touchable';

/**
 * One benchmark in the list.
 *
 * An untested benchmark shows the invitation, not a zero: a blank row reads as
 * "not yet", where "0" would read as a bad score. Only tested ones carry a
 * number.
 */
type Props = {
  definition: BenchmarkDefinition;
  best: BenchmarkResult | null;
  count: number;
  units: UnitSystem;
  onOpen: (id: string) => void;
};

export const BenchmarkRow = memo(function BenchmarkRow({
  definition,
  best,
  count,
  units,
  onOpen,
}: Props) {
  const handlePress = useCallback(() => onOpen(definition.id), [definition.id, onOpen]);

  const value = best ? formatBenchmarkValue(best.value, definition.metric, units) : null;

  return (
    <PressableScale
      onPress={handlePress}
      haptic="selection"
      scaleTo={0.98}
      accessibilityLabel={
        value
          ? `${definition.name}. Best ${value}, ${count} ${count === 1 ? 'result' : 'results'}.`
          : `${definition.name}. Not tested yet.`
      }
      style={styles.row}
    >
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {definition.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {BENCHMARK_METRIC_LABEL[definition.metric]}
          {definition.isCustom ? ' • yours' : ''}
          {count > 0 ? ` • ${count} logged` : ''}
        </Text>
      </View>

      {value ? (
        <View style={styles.valueBlock}>
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
          <Text style={styles.valueLabel}>best</Text>
        </View>
      ) : (
        <Text style={styles.untested}>Not tested</Text>
      )}

      <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.hairline,
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
  },
  meta: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textFaint,
    marginTop: 2,
  },
  valueBlock: {
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 15,
    fontWeight: '800',
    color: accentColor.lime,
  },
  valueLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: palette.textFaint,
  },
  untested: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textFaint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: palette.glassSunken,
  },
});
