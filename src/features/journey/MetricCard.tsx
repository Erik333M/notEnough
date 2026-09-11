import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { MetricDescriptor, MetricPoint } from '../../state/journey/measurements';
import { metricChange, metricUnit } from '../../state/journey/measurements';
import type { UnitSystem } from '../../state/journey/types';
import { formatSeconds, roundTo } from '../../state/journey/units';
import { accentColor, palette, radius } from '../../theme/theme';
import { GlassCard } from '../../ui/Glass';
import { LineChart } from '../../ui/Progress';

/**
 * One tracked metric: its latest value, its movement, and a trend if there is
 * enough to draw one.
 *
 * The change is stated without a verdict — no red for "up", no green for
 * "down". Whether a rising number is good depends entirely on what the person
 * is trying to do, and this feature records rather than judges. The only
 * colour is the neutral accent.
 */
type Props = {
  metric: MetricDescriptor;
  points: MetricPoint[];
  units: UnitSystem;
};

function formatValue(metric: MetricDescriptor, value: number, units: UnitSystem): string {
  if (metric.input === 'duration') return formatSeconds(value);
  const unit = metricUnit(metric, units);
  const shown = roundTo(value, metric.decimals);
  return unit ? `${shown} ${unit}` : `${shown}`;
}

export const MetricCard = memo(function MetricCard({ metric, points, units }: Props) {
  if (points.length === 0) return null;

  const latest = points[points.length - 1].value;
  const change = metricChange(points);
  const canChart = points.length >= 2;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>{metric.label.toUpperCase()}</Text>
        <Text style={styles.count}>
          {points.length} {points.length === 1 ? 'reading' : 'readings'}
        </Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value}>{formatValue(metric, latest, units)}</Text>
        {change !== null && change !== 0 ? (
          <Text style={styles.change}>
            {change > 0 ? '+' : ''}
            {metric.input === 'duration'
              ? `${roundTo(change, 0)}s`
              : roundTo(change, metric.decimals)}{' '}
            since the first
          </Text>
        ) : null}
      </View>

      {canChart ? (
        <LineChart
          points={points.map((p) => ({ value: p.value }))}
          accent="cyan"
          height={120}
          formatValue={(value) => formatValue(metric, value, units)}
        />
      ) : (
        <Text style={styles.hint}>Log this once more and a line appears here.</Text>
      )}
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: 10,
    borderRadius: radius.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: palette.textMuted,
  },
  count: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.textFaint,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.text,
  },
  change: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: accentColor.cyan,
  },
  hint: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textFaint,
  },
});
