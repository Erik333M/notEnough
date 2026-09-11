import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { MeasurementBaseline, UnitSystem } from '../../state/journey/types';
import {
  displayLength,
  displayWeight,
  lengthUnit,
  roundTo,
  weightUnit,
} from '../../state/journey/units';
import { palette, radius } from '../../theme/theme';
import { GlassCard } from '../../ui/Glass';
import { PressableScale } from '../../ui/Touchable';

/**
 * The baseline, summarised.
 *
 * Empty, it is one line inviting a tap rather than five dashes — a card full
 * of "—" reads as five things you have failed to supply. Filled, it shows only
 * the figures that are actually set.
 */
type Props = {
  baseline: MeasurementBaseline;
  units: UnitSystem;
  onEdit: () => void;
};

export const BaselineCard = memo(function BaselineCard({ baseline, units, onEdit }: Props) {
  const rows: Array<{ label: string; value: string }> = [];

  if (baseline.heightCm !== null) {
    rows.push({
      label: 'Height',
      value: `${roundTo(displayLength(baseline.heightCm, units) ?? 0, 1)} ${lengthUnit(units)}`,
    });
  }
  if (baseline.currentWeightKg !== null) {
    rows.push({
      label: 'Current',
      value: `${roundTo(displayWeight(baseline.currentWeightKg, units) ?? 0, 1)} ${weightUnit(units)}`,
    });
  }
  if (baseline.targetWeightKg !== null) {
    rows.push({
      label: 'Target',
      value: `${roundTo(displayWeight(baseline.targetWeightKg, units) ?? 0, 1)} ${weightUnit(units)}`,
    });
  }
  if (baseline.restingHeartRate !== null) {
    rows.push({ label: 'Resting HR', value: `${baseline.restingHeartRate} bpm` });
  }
  if (baseline.referenceHeartRate !== null) {
    rows.push({ label: 'Reference HR', value: `${baseline.referenceHeartRate} bpm` });
  }

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>BASELINE</Text>
      </View>

      <PressableScale
        onPress={onEdit}
        haptic="light"
        scaleTo={0.99}
        accessibilityLabel={
          rows.length === 0 ? 'Add your baseline figures' : 'Edit your baseline figures'
        }
        style={styles.body}
      >
        {rows.length === 0 ? (
          <Text style={styles.empty}>
            Add height, weight or resting heart rate — or skip it entirely.
          </Text>
        ) : (
          <View style={styles.rows}>
            {rows.map((row) => (
              <View key={row.label} style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        )}
      </PressableScale>
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
  },
  label: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: palette.textMuted,
  },
  body: {
    minHeight: 44,
    justifyContent: 'center',
  },
  empty: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.textMuted,
  },
  rows: {
    gap: 7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: palette.textFaint,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.text,
  },
});
