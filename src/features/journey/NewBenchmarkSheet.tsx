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

import {
  BENCHMARK_GROUP_LABEL,
  BENCHMARK_METRIC_LABEL,
  lowerIsBetter,
} from '../../state/journey/benchmarks';
import type { BenchmarkGroup, BenchmarkMetric } from '../../state/journey/types';
import { palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { Chip, RoundIconButton, SectionHeader } from '../../ui/Controls';
import { Field } from '../../ui/Field';

/**
 * Adds a benchmark of the user's own.
 *
 * The metric is the only choice that matters, because it decides how results
 * are entered *and* which direction counts as an improvement — so the sheet
 * spells that consequence out under the chips rather than leaving the user to
 * discover it after logging three results.
 */
type Props = {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, group: BenchmarkGroup, metric: BenchmarkMetric) => void;
};

const GROUPS = Object.keys(BENCHMARK_GROUP_LABEL) as BenchmarkGroup[];
const METRICS = Object.keys(BENCHMARK_METRIC_LABEL) as BenchmarkMetric[];

/** Plain-language gloss for each metric, shown as help under the chips. */
const METRIC_HINT: Record<BenchmarkMetric, string> = {
  time: 'A time you want to get faster at.',
  duration: 'A hold you want to get longer at.',
  reps: 'A count you want to get higher.',
  weight: 'A load you want to get heavier.',
};

export function NewBenchmarkSheet({ visible, onClose, onCreate }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [group, setGroup] = useState<BenchmarkGroup>('weightlifting');
  const [metric, setMetric] = useState<BenchmarkMetric>('reps');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setGroup('weightlifting');
    setMetric('reps');
    setError(null);
  }, [visible]);

  const handleSave = useCallback(() => {
    const clean = name.trim();
    if (clean.length < 2) {
      setError('Give the test a name.');
      return;
    }
    onCreate(clean, group, metric);
  }, [name, group, metric, onCreate]);

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
              title="New benchmark"
              meta="A test you want to repeat and compare"
              action={
                <RoundIconButton
                  icon="close"
                  size={34}
                  onPress={onClose}
                  accessibilityLabel="Close"
                />
              }
            />

            <Field
              label="Name"
              value={name}
              onChangeText={(next) => {
                setName(next);
                if (error) setError(null);
              }}
              placeholder="2 km row"
              icon="stopwatch-outline"
              error={error}
              autoCapitalize="sentences"
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <View style={styles.group}>
              <Text style={styles.groupLabel}>How is it measured?</Text>
              <View style={styles.chips}>
                {METRICS.map((key) => (
                  <Chip
                    key={key}
                    label={BENCHMARK_METRIC_LABEL[key]}
                    active={metric === key}
                    accent="cyan"
                    onPress={() => setMetric(key)}
                  />
                ))}
              </View>
              <Text style={styles.hint}>
                {METRIC_HINT[metric]} A personal best is the{' '}
                {lowerIsBetter(metric) ? 'lowest' : 'highest'} result you have logged.
              </Text>
            </View>

            <View style={styles.group}>
              <Text style={styles.groupLabel}>Group</Text>
              <View style={styles.chips}>
                {GROUPS.map((key) => (
                  <Chip
                    key={key}
                    label={BENCHMARK_GROUP_LABEL[key]}
                    active={group === key}
                    accent="violet"
                    onPress={() => setGroup(key)}
                  />
                ))}
              </View>
            </View>

            <Button label="Add benchmark" icon="checkmark" onPress={handleSave} />
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
  group: {
    gap: 8,
  },
  groupLabel: {
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
  hint: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: palette.textFaint,
    marginLeft: 2,
  },
});
