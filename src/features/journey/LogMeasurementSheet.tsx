import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DayKey, MeasurementEntry, UnitSystem } from '../../state/journey/types';
import { palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { Chip, RoundIconButton, SectionHeader } from '../../ui/Controls';
import { DatePickRow } from './DatePickRow';
import { MeasurementField } from './MeasurementField';
import { ALWAYS_SHOWN, useMeasurementDrafts } from './useMeasurementDrafts';

/**
 * Records one dated set of readings.
 *
 * Opens with weight and nothing else. The other seven are chips you add if you
 * happen to have them — a scale that reports body fat, a heart-rate strap —
 * because showing eight empty boxes to someone who only ever weighs themselves
 * is exactly the wall of inputs this feature is meant to avoid.
 *
 * Editing an existing reading reveals whichever fields it already holds.
 */
type Props = {
  visible: boolean;
  units: UnitSystem;
  existing: MeasurementEntry | null;
  onClose: () => void;
  onSave: (date: DayKey, values: Partial<MeasurementEntry>) => void;
  onDelete?: (id: string) => void;
};

export function LogMeasurementSheet({
  visible,
  units,
  existing,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);

  const {
    drafts,
    date,
    setDate,
    hidden,
    visibleMetrics,
    setDraft,
    addField,
    removeField,
    parse,
  } = useMeasurementDrafts(visible, existing, units);

  useEffect(() => {
    if (visible) setError(null);
  }, [visible]);

  const handleSave = useCallback(() => {
    const outcome = parse();
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    onSave(date, outcome.values);
  }, [parse, date, onSave]);

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

            <SectionHeader
              title={existing ? 'Edit reading' : 'New reading'}
              meta="Fill in whatever you have"
              action={
                <RoundIconButton
                  icon="close"
                  size={34}
                  onPress={onClose}
                  accessibilityLabel="Close"
                />
              }
            />

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.content}
            >
              <DatePickRow date={date} onChange={setDate} />

              {visibleMetrics.map((metric) => (
                <MeasurementField
                  key={metric.key}
                  metric={metric}
                  units={units}
                  draft={drafts[metric.key]}
                  onChange={(next) => {
                    setDraft(metric.key, next);
                    setError(null);
                  }}
                  onRemove={
                    metric.key === ALWAYS_SHOWN ? undefined : () => removeField(metric.key)
                  }
                  showHint
                />
              ))}

              {hidden.length > 0 ? (
                <View style={styles.addBlock}>
                  <Text style={styles.addLabel}>Add another reading</Text>
                  <View style={styles.chips}>
                    {hidden.map((metric) => (
                      <Chip
                        key={metric.key}
                        label={metric.label}
                        active={false}
                        accent="cyan"
                        onPress={() => addField(metric.key)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button
                label={existing ? 'Save changes' : 'Save reading'}
                icon="checkmark"
                onPress={handleSave}
              />

              {existing && onDelete ? (
                <Button
                  label="Delete this reading"
                  icon="trash-outline"
                  variant="danger"
                  onPress={handleDelete}
                />
              ) : null}
            </ScrollView>
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
    height: '90%',
  },
  sheet: {
    flex: 1,
    backgroundColor: '#111634',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.hairlineStrong,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 14,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.hairlineStrong,
  },
  content: {
    gap: 16,
    paddingBottom: 16,
  },
  addBlock: {
    gap: 8,
  },
  addLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.textMuted,
    marginLeft: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  error: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.rose,
    marginLeft: 2,
  },
});
