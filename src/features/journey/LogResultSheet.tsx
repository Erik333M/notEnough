import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dayKey } from '../../lib/time';
import { BENCHMARK_METRIC_LABEL, lowerIsBetter } from '../../state/journey/benchmarks';
import type { BenchmarkDefinition, DayKey, UnitSystem } from '../../state/journey/types';
import { storeWeight } from '../../state/journey/units';
import { palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { RoundIconButton, SectionHeader } from '../../ui/Controls';
import { Field } from '../../ui/Field';
import { DatePickRow } from './DatePickRow';
import {
  ValueInput,
  draftFromValue,
  emptyValueDraft,
  valueFromDraft,
  type ValueDraft,
} from './ValueInput';

/**
 * Records one benchmark result.
 *
 * The date defaults to today but is editable, because a re-test usually gets
 * written up afterwards rather than on the gym floor. Notes are free text and
 * optional — "felt easy", "wrong shoes", "judged by Sam".
 */
type Props = {
  visible: boolean;
  definition: BenchmarkDefinition | null;
  units: UnitSystem;
  /** Set when editing an existing result rather than adding one. */
  existing: { id: string; value: number; date: DayKey; notes: string } | null;
  onClose: () => void;
  onSave: (value: number, date: DayKey, notes: string) => void;
  onDelete?: (id: string) => void;
};

export function LogResultSheet({
  visible,
  definition,
  units,
  existing,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ValueDraft>(emptyValueDraft());
  const [date, setDate] = useState<DayKey>(dayKey());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset on open so a cancelled entry never leaks into the next one.
  useEffect(() => {
    if (!visible || !definition) return;
    setDraft(existing ? draftFromValue(existing.value, definition.metric) : emptyValueDraft());
    setDate(existing?.date ?? dayKey());
    setNotes(existing?.notes ?? '');
    setError(null);
  }, [visible, definition, existing]);

  const handleSave = useCallback(() => {
    if (!definition) return;

    const parsed = valueFromDraft(draft, definition.metric);
    if (parsed === null) {
      setError('Enter a result first.');
      return;
    }

    // Weight is typed in whatever the user reads and stored in kilograms.
    const value =
      definition.metric === 'weight' ? (storeWeight(parsed, units) ?? parsed) : parsed;

    onSave(value, date, notes.trim());
  }, [definition, draft, units, date, notes, onSave]);

  const handleDelete = useCallback(() => {
    if (existing && onDelete) onDelete(existing.id);
  }, [existing, onDelete]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grabber} />

            {definition ? (
              <>
                <SectionHeader
                  title={definition.name}
                  meta={`${BENCHMARK_METRIC_LABEL[definition.metric]} • ${
                    lowerIsBetter(definition.metric) ? 'lower is better' : 'higher is better'
                  }`}
                  action={
                    <RoundIconButton
                      icon="close"
                      size={34}
                      onPress={onClose}
                      accessibilityLabel="Close"
                    />
                  }
                />

                <View style={styles.valueBlock}>
                  <ValueInput
                    metric={definition.metric}
                    units={units}
                    draft={draft}
                    onChange={(next) => {
                      setDraft(next);
                      if (error) setError(null);
                    }}
                  />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                </View>

                <DatePickRow date={date} onChange={setDate} />

                <Field
                  label="Notes"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Optional — how it felt, conditions, anything"
                  icon="create-outline"
                  autoCapitalize="sentences"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />

                <Button
                  label={existing ? 'Save changes' : 'Log result'}
                  icon="checkmark"
                  onPress={handleSave}
                />

                {existing && onDelete ? (
                  <Button
                    label="Delete this result"
                    icon="trash-outline"
                    variant="danger"
                    onPress={handleDelete}
                  />
                ) : null}
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2,3,10,0.72)',
  },
  sheetWrap: {
    maxHeight: '92%',
  },
  sheet: {
    backgroundColor: '#111634',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairlineStrong,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 16,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.hairlineStrong,
  },
  valueBlock: {
    alignItems: 'center',
    gap: 8,
  },
  error: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.rose,
  },
});
