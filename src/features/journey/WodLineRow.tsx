import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { UnitSystem, WodLine } from '../../state/journey/types';
import { displayWeight, roundTo, storeWeight, weightUnit } from '../../state/journey/units';
import { palette, radius } from '../../theme/theme';
import { PressableScale } from '../../ui/Touchable';

/**
 * One line of a workout: reps × movement @ weight.
 *
 * Reps and weight are their own small numeric inputs rather than steppers —
 * a workout is transcribed from paper or memory in whole numbers, and typing
 * "21" beats tapping a plus button twenty-one times.
 *
 * The movement itself is a button, not a text field: tapping opens the search
 * sheet. That keeps the catalogue as the primary path while still allowing
 * free text, since the sheet can hand back either.
 */
type Props = {
  line: WodLine;
  /** Catalogue name if the line is linked, else what the user typed. */
  label: string;
  units: UnitSystem;
  onPickMovement: (id: string) => void;
  onChange: (id: string, patch: Partial<WodLine>) => void;
  onRemove: (id: string) => void;
};

/** Digits only. An empty box is null, not zero — the field is optional. */
function parseCount(text: string): number | null {
  const digits = text.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Weight allows one decimal point, since plates are not whole numbers. */
function parseWeight(text: string): number | null {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (!cleaned || cleaned === '.') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export const WodLineRow = memo(function WodLineRow({
  line,
  label,
  units,
  onPickMovement,
  onChange,
  onRemove,
}: Props) {
  const handleReps = useCallback(
    (text: string) => onChange(line.id, { reps: parseCount(text) }),
    [line.id, onChange],
  );

  const handleWeight = useCallback(
    (text: string) => {
      const typed = parseWeight(text);
      // Stored canonically in kilograms, converted from whatever the user sees.
      onChange(line.id, { weightKg: storeWeight(typed, units) });
    },
    [line.id, onChange, units],
  );

  const handlePick = useCallback(() => onPickMovement(line.id), [line.id, onPickMovement]);
  const handleRemove = useCallback(() => onRemove(line.id), [line.id, onRemove]);

  const shownWeight = displayWeight(line.weightKg, units);

  return (
    <View style={styles.row}>
      <TextInput
        value={line.reps === null ? '' : `${line.reps}`}
        onChangeText={handleReps}
        placeholder="—"
        placeholderTextColor={palette.textFaint}
        style={[styles.box, styles.reps]}
        keyboardType="number-pad"
        returnKeyType="done"
        maxLength={4}
        selectionColor={palette.violet}
        accessibilityLabel="Reps"
      />

      <PressableScale
        onPress={handlePick}
        haptic="selection"
        scaleTo={0.98}
        accessibilityLabel={label ? `Movement: ${label}. Tap to change.` : 'Choose a movement'}
        style={styles.movement}
      >
        <Text
          style={[styles.movementText, !label && styles.movementPlaceholder]}
          numberOfLines={1}
        >
          {label || 'Choose a movement'}
        </Text>
        <Ionicons name="chevron-down" size={14} color={palette.textFaint} />
      </PressableScale>

      <View style={styles.weightWrap}>
        <TextInput
          value={shownWeight === null ? '' : `${roundTo(shownWeight, 1)}`}
          onChangeText={handleWeight}
          placeholder="—"
          placeholderTextColor={palette.textFaint}
          style={[styles.box, styles.weight]}
          keyboardType="decimal-pad"
          returnKeyType="done"
          maxLength={6}
          selectionColor={palette.violet}
          accessibilityLabel={`Weight in ${weightUnit(units)}`}
        />
        <Text style={styles.unit}>{weightUnit(units)}</Text>
      </View>

      <PressableScale
        onPress={handleRemove}
        haptic="light"
        scaleTo={0.86}
        hitSlop={10}
        accessibilityLabel={`Remove ${label || 'this line'}`}
        style={styles.remove}
      >
        <Ionicons name="close" size={16} color={palette.textFaint} />
      </PressableScale>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
  },
  box: {
    height: 44,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
    backgroundColor: palette.glassSunken,
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  reps: {
    width: 52,
  },
  movement: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 11,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
    backgroundColor: palette.glassSunken,
  },
  movementText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
  movementPlaceholder: {
    color: palette.textFaint,
    fontWeight: '600',
  },
  weightWrap: {
    alignItems: 'center',
    gap: 2,
  },
  weight: {
    width: 56,
  },
  unit: {
    fontSize: 9,
    fontWeight: '700',
    color: palette.textFaint,
  },
  remove: {
    width: 30,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
