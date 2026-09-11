import { memo, useCallback, useEffect, useState } from 'react';
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

import {
  BASELINE_ROWS,
  baselineToDisplay,
  baselineToStored,
  baselineUnit,
  type BaselineKey,
} from '../../state/journey/baselineFields';
import { BOUNDS } from '../../state/journey/bounds';
import type { MeasurementBaseline, UnitSystem } from '../../state/journey/types';
import { palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { RoundIconButton, SectionHeader } from '../../ui/Controls';
import { Field } from '../../ui/Field';

/**
 * The five baseline figures.
 *
 * Captured once and edited rarely, which is why they are a sheet rather than a
 * dated reading — height does not belong in a time series. Every one is
 * optional and blank clears it: leaving your target weight empty is a valid
 * answer, and this feature does not prescribe one.
 */
/**
 * The five baseline figures.
 *
 * Captured once and edited rarely, which is why they are a sheet rather than a
 * dated reading — height does not belong in a time series. Every one is
 * optional and blank clears it: leaving your target weight empty is a valid
 * answer, and this feature does not prescribe one.
 */
type Props = {
  visible: boolean;
  baseline: MeasurementBaseline;
  units: UnitSystem;
  onClose: () => void;
  onSave: (patch: MeasurementBaseline) => void;
};

export function BaselineSheet({ visible, baseline, units, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState<Record<BaselineKey, string>>(
    {} as Record<BaselineKey, string>,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const next = {} as Record<BaselineKey, string>;
    for (const row of BASELINE_ROWS) {
      next[row.key] = baselineToDisplay(row.key, baseline[row.key], units);
    }
    setText(next);
    setError(null);
  }, [visible, baseline, units]);

  const handleSave = useCallback(() => {
    const next = {} as MeasurementBaseline;

    for (const row of BASELINE_ROWS) {
      const stored = baselineToStored(row.key, text[row.key] ?? '', units);
      if (stored === null) {
        next[row.key] = null;
        continue;
      }
      const [min, max] = BOUNDS[row.key];
      if (stored < min || stored > max) {
        setError(`${row.label} looks out of range. Check it and try again.`);
        return;
      }
      next[row.key] = stored;
    }

    onSave(next);
  }, [text, units, onSave]);

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
              title="Baseline"
              meta="Where you are starting from. All optional."
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
              {BASELINE_ROWS.map((row) => (
                <View key={row.key} style={styles.row}>
                  <BaselineInput
                    label={`${row.label} (${baselineUnit(row.key, units)})`}
                    value={text[row.key] ?? ''}
                    onChange={(next) => {
                      setText((current) => ({ ...current, [row.key]: next }));
                      if (error) setError(null);
                    }}
                  />
                  {row.hint ? <Text style={styles.hint}>{row.hint}</Text> : null}
                </View>
              ))}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button label="Save baseline" icon="checkmark" onPress={handleSave} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/**
 * A baseline row: the shared field with a numeric keyboard and one decimal
 * point allowed, however many the user types.
 */
const BaselineInput = memo(function BaselineInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const handle = useCallback(
    (text: string) => {
      const cleaned = text.replace(/[^0-9.]/g, '');
      const [head, ...rest] = cleaned.split('.');
      onChange(rest.length > 0 ? `${head}.${rest.join('')}` : head);
    },
    [onChange],
  );

  return (
    <Field
      label={label}
      value={value}
      onChangeText={handle}
      placeholder="Leave blank if you do not know"
      keyboardType="decimal-pad"
      returnKeyType="done"
    />
  );
});

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
  row: {
    gap: 6,
  },
  hint: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: palette.textFaint,
    marginLeft: 2,
  },
  error: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.rose,
    marginLeft: 2,
  },
});
