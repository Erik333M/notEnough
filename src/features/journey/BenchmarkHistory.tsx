import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { longDateLabel } from '../../lib/time';
import { lowerIsBetter } from '../../state/journey/benchmarks';
import type { BenchmarkMetric, BenchmarkResult } from '../../state/journey/types';
import { accentColor, palette, radius } from '../../theme/theme';
import { StatTile } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';
import { LineChart } from '../../ui/Progress';
import { PressableScale } from '../../ui/Touchable';

/**
 * The summary above a benchmark's history: best, latest, count and a trend.
 *
 * The caption names which direction is an improvement rather than the chart
 * silently inverting itself per metric — a line that meant "up is good" on one
 * screen and "down is good" on the next would be unreadable.
 */
export const BenchmarkSummary = memo(function BenchmarkSummary({
  metric,
  bestLabel,
  latestLabel,
  count,
  series,
  format,
}: {
  metric: BenchmarkMetric;
  bestLabel: string;
  latestLabel: string;
  count: number;
  series: number[];
  format: (value: number) => string;
}) {
  return (
    <GlassCard style={styles.card}>
      <View style={styles.statRow}>
        <StatTile value={bestLabel} label="Best" accent="lime" />
        <StatTile value={latestLabel} label="Latest" accent="cyan" />
        <StatTile value={`${count}`} label="Logged" accent="violet" />
      </View>

      {series.length >= 2 ? (
        <View style={styles.chartBlock}>
          <LineChart
            points={series.map((value) => ({ value }))}
            accent="cyan"
            height={140}
            formatValue={format}
          />
          <Text style={styles.caption}>
            Oldest to newest • {lowerIsBetter(metric) ? 'down' : 'up'} is an improvement
          </Text>
        </View>
      ) : (
        <Text style={styles.caption}>Log it once more and a trend line appears here.</Text>
      )}
    </GlassCard>
  );
});

/** One dated result. Tapping it reopens the sheet to correct or delete it. */
export const ResultRow = memo(function ResultRow({
  result,
  label,
  isPb,
  onPress,
}: {
  result: BenchmarkResult;
  label: string;
  isPb: boolean;
  onPress: (result: BenchmarkResult) => void;
}) {
  const handlePress = useCallback(() => onPress(result), [result, onPress]);

  return (
    <PressableScale
      onPress={handlePress}
      haptic="selection"
      scaleTo={0.98}
      accessibilityLabel={`${label} on ${longDateLabel(result.date)}${
        isPb ? ', a personal best' : ''
      }. Tap to edit.`}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text style={styles.rowValue}>{label}</Text>
          {isPb ? (
            <View style={styles.pb}>
              <Ionicons name="trophy" size={10} color={palette.onAccent} />
              <Text style={styles.pbText}>PB</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rowDate} numberOfLines={1}>
          {longDateLabel(result.date)}
          {result.notes ? ` • ${result.notes}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={palette.textFaint} />
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: 14,
    borderRadius: radius.lg,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chartBlock: {
    gap: 8,
  },
  caption: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textFaint,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 58,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.hairline,
  },
  rowText: {
    flex: 1,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
  },
  pb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: accentColor.lime,
  },
  pbText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: palette.onAccent,
  },
  rowDate: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textFaint,
    marginTop: 2,
  },
});
