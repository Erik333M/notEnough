import { memo, useCallback } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { BenchmarkMetric, UnitSystem } from '../../state/journey/types';
import { weightUnit } from '../../state/journey/units';
import { palette, radius } from '../../theme/theme';

/**
 * Entry control for a benchmark result.
 *
 * The metric decides the shape, because a 400 m time and a one-rep max are not
 * the same question. Times get two boxes (minutes and seconds) rather than one
 * "enter seconds" field — nobody reads their stopwatch as 218 seconds, and
 * making them do the arithmetic is exactly the kind of friction that stops a
 * log getting written.
 *
 * Everything is held as a string while editing so a half-typed value never
 * snaps to a parsed number under the cursor. The parent converts on save.
 */
export type ValueDraft = {
  /** Minutes box, for time and duration metrics. */
  minutes: string;
  /** Seconds box for time/duration; the whole value for reps and weight. */
  amount: string;
};

export const emptyValueDraft = (): ValueDraft => ({ minutes: '', amount: '' });

/** Seconds -> the two boxes, for editing an existing result. */
export function draftFromValue(value: number, metric: BenchmarkMetric): ValueDraft {
  if (metric === 'time' || metric === 'duration') {
    const total = Math.max(0, Math.round(value));
    return { minutes: `${Math.floor(total / 60)}`, amount: `${total % 60}` };
  }
  return { minutes: '', amount: `${value}` };
}

/**
 * The two boxes -> a stored number, or null when there is nothing to store.
 * Weight arrives in the display unit and is converted by the caller.
 */
export function valueFromDraft(draft: ValueDraft, metric: BenchmarkMetric): number | null {
  if (metric === 'time' || metric === 'duration') {
    const minutes = Number(draft.minutes || '0');
    const seconds = Number(draft.amount || '0');
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    const total = minutes * 60 + seconds;
    return total > 0 ? total : null;
  }

  const amount = Number(draft.amount);
  if (!draft.amount.trim() || !Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

function digits(text: string): string {
  return text.replace(/[^0-9]/g, '');
}

function decimal(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  // One decimal point only, however many the user types.
  const [head, ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${head}.${rest.join('')}` : head;
}

type Props = {
  metric: BenchmarkMetric;
  units: UnitSystem;
  draft: ValueDraft;
  onChange: (draft: ValueDraft) => void;
};

export const ValueInput = memo(function ValueInput({ metric, units, draft, onChange }: Props) {
  const setMinutes = useCallback(
    (text: string) => onChange({ ...draft, minutes: digits(text).slice(0, 3) }),
    [draft, onChange],
  );

  const setAmount = useCallback(
    (text: string) => {
      const next = metric === 'weight' ? decimal(text) : digits(text);
      onChange({ ...draft, amount: next.slice(0, 6) });
    },
    [draft, onChange, metric],
  );

  if (metric === 'time' || metric === 'duration') {
    return (
      <View style={styles.row}>
        <View style={styles.field}>
          <TextInput
            value={draft.minutes}
            onChangeText={setMinutes}
            placeholder="0"
            placeholderTextColor={palette.textFaint}
            style={styles.box}
            keyboardType="number-pad"
            returnKeyType="done"
            selectionColor={palette.violet}
            accessibilityLabel="Minutes"
          />
          <Text style={styles.unit}>min</Text>
        </View>

        <Text style={styles.colon}>:</Text>

        <View style={styles.field}>
          <TextInput
            value={draft.amount}
            onChangeText={setAmount}
            placeholder="00"
            placeholderTextColor={palette.textFaint}
            style={styles.box}
            keyboardType="number-pad"
            returnKeyType="done"
            selectionColor={palette.violet}
            accessibilityLabel="Seconds"
          />
          <Text style={styles.unit}>sec</Text>
        </View>
      </View>
    );
  }

  const label = metric === 'weight' ? weightUnit(units) : 'reps';

  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <TextInput
          value={draft.amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor={palette.textFaint}
          style={styles.box}
          keyboardType={metric === 'weight' ? 'decimal-pad' : 'number-pad'}
          returnKeyType="done"
          selectionColor={palette.violet}
          accessibilityLabel={metric === 'weight' ? `Weight in ${label}` : 'Repetitions'}
        />
        <Text style={styles.unit}>{label}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  field: {
    alignItems: 'center',
    gap: 4,
  },
  box: {
    width: 92,
    height: 56,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairlineStrong,
    backgroundColor: palette.glassSunken,
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  unit: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: palette.textFaint,
  },
  colon: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.textFaint,
    marginBottom: 14,
  },
});
