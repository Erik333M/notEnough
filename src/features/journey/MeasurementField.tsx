import { memo, useCallback } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { MetricDescriptor } from '../../state/journey/measurements';
import { metricUnit } from '../../state/journey/measurements';
import type { UnitSystem } from '../../state/journey/types';
import { palette, radius } from '../../theme/theme';
import { PressableScale } from '../../ui/Touchable';

/**
 * One optional reading.
 *
 * Held as strings while editing so a half-typed "7" never snaps to 7 under the
 * cursor, and so clearing a field means "I do not know this" rather than zero.
 * Zero is a real answer for workouts-a-week; blank is not the same thing.
 *
 * Duration fields get two boxes, because breathing recovery is read off a
 * clock as minutes and seconds.
 */
export type FieldDraft = { minutes: string; amount: string };

export const emptyFieldDraft = (): FieldDraft => ({ minutes: '', amount: '' });

/** A stored value -> the boxes. Weight arrives already converted for display. */
export function draftFromNumber(
  value: number | null,
  input: MetricDescriptor['input'],
): FieldDraft {
  if (value === null) return emptyFieldDraft();
  if (input === 'duration') {
    const total = Math.max(0, Math.round(value));
    return { minutes: `${Math.floor(total / 60)}`, amount: `${total % 60}` };
  }
  return { minutes: '', amount: `${value}` };
}

/**
 * The boxes -> a value, or null for "left blank".
 *
 * A duration of 0:00 counts as blank — nobody's breathing recovers in no time,
 * so it can only mean the field was skipped. A plain 0 is kept, because zero
 * workouts in a week is a genuine reading.
 */
export function numberFromDraft(
  draft: FieldDraft,
  input: MetricDescriptor['input'],
): number | null {
  if (input === 'duration') {
    const total = Number(draft.minutes || '0') * 60 + Number(draft.amount || '0');
    return Number.isFinite(total) && total > 0 ? total : null;
  }
  if (!draft.amount.trim()) return null;
  const value = Number(draft.amount);
  return Number.isFinite(value) ? value : null;
}

function digits(text: string): string {
  return text.replace(/[^0-9]/g, '');
}

function decimal(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const [head, ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${head}.${rest.join('')}` : head;
}

type Props = {
  metric: MetricDescriptor;
  units: UnitSystem;
  draft: FieldDraft;
  onChange: (draft: FieldDraft) => void;
  /** Removes the field from the form again. */
  onRemove?: () => void;
  /** Shows the descriptor's help text under the control. */
  showHint?: boolean;
};

export const MeasurementField = memo(function MeasurementField({
  metric,
  units,
  draft,
  onChange,
  onRemove,
  showHint = false,
}: Props) {
  const setAmount = useCallback(
    (text: string) => {
      const next = metric.decimals > 0 ? decimal(text) : digits(text);
      onChange({ ...draft, amount: next.slice(0, 7) });
    },
    [draft, onChange, metric.decimals],
  );

  const setMinutes = useCallback(
    (text: string) => onChange({ ...draft, minutes: digits(text).slice(0, 3) }),
    [draft, onChange],
  );

  const unit = metricUnit(metric, units);
  const isDuration = metric.input === 'duration';

  return (
    <View style={styles.group}>
      <View style={styles.header}>
        <Text style={styles.label}>{metric.label}</Text>
        {onRemove ? (
          <PressableScale
            onPress={onRemove}
            haptic="light"
            scaleTo={0.86}
            hitSlop={10}
            accessibilityLabel={`Remove the ${metric.label} field`}
            style={styles.remove}
          >
            <Text style={styles.removeText}>Remove</Text>
          </PressableScale>
        ) : null}
      </View>

      {isDuration ? (
        <View style={styles.row}>
          <TextInput
            value={draft.minutes}
            onChangeText={setMinutes}
            placeholder="0"
            placeholderTextColor={palette.textFaint}
            style={[styles.box, styles.duration]}
            keyboardType="number-pad"
            returnKeyType="done"
            selectionColor={palette.violet}
            accessibilityLabel={`${metric.label}, minutes`}
          />
          <Text style={styles.suffix}>min</Text>
          <TextInput
            value={draft.amount}
            onChangeText={setAmount}
            placeholder="00"
            placeholderTextColor={palette.textFaint}
            style={[styles.box, styles.duration]}
            keyboardType="number-pad"
            returnKeyType="done"
            selectionColor={palette.violet}
            accessibilityLabel={`${metric.label}, seconds`}
          />
          <Text style={styles.suffix}>sec</Text>
        </View>
      ) : (
        <View style={styles.row}>
          <TextInput
            value={draft.amount}
            onChangeText={setAmount}
            placeholder="—"
            placeholderTextColor={palette.textFaint}
            style={[styles.box, styles.single]}
            keyboardType={metric.decimals > 0 ? 'decimal-pad' : 'number-pad'}
            returnKeyType="done"
            selectionColor={palette.violet}
            accessibilityLabel={unit ? `${metric.label} in ${unit}` : metric.label}
          />
          {unit ? <Text style={styles.suffix}>{unit}</Text> : null}
        </View>
      )}

      {showHint && metric.hint ? <Text style={styles.hint}>{metric.hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  group: {
    gap: 7,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: palette.textMuted,
    marginLeft: 2,
  },
  remove: {
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  removeText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textFaint,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  box: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairline,
    backgroundColor: palette.glassSunken,
    color: palette.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  single: {
    flex: 1,
  },
  duration: {
    width: 78,
  },
  suffix: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.textFaint,
    minWidth: 26,
  },
  hint: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: palette.textFaint,
    marginLeft: 2,
  },
});
