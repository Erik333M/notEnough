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

import type { VictoryGoalKey } from '../../state/types';
import { goalDef, victoryDef } from '../../state/victories';
import { accentColor, accentSoft, palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { Chip, RoundIconButton, SectionHeader } from '../../ui/Controls';
import { Field } from '../../ui/Field';
import { GlassCard } from '../../ui/Glass';

type Props = {
  /** Null closes the sheet; a key opens it for that goal. */
  goal: VictoryGoalKey | null;
  target: string;
  onClose: () => void;
  onSave: (goal: VictoryGoalKey, target: string) => void;
};

const MAX_TARGET = 60;

/**
 * Custom target editor.
 *
 * The category, its title and its description are fixed — only the target line
 * is editable, which is the point of the feature: the standard stays put, the
 * measure adapts. The catalogue's examples become one-tap fills so setting a
 * target never starts from an empty box.
 */
export function VictoryTargetEditor({ goal, target, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset on open so a cancelled edit never leaks into the next goal.
  useEffect(() => {
    if (!goal) return;
    setValue(target);
    setError(null);
  }, [goal, target]);

  const handleSave = useCallback(() => {
    if (!goal) return;
    const clean = value.trim();
    if (clean.length < 2) {
      setError('Give the target something to measure.');
      return;
    }
    onSave(goal, clean.slice(0, MAX_TARGET));
    onClose();
  }, [goal, onClose, onSave, value]);

  const handleReset = useCallback(() => {
    if (!goal) return;
    setValue(goalDef(goal).defaultTarget);
    setError(null);
  }, [goal]);

  const def = goal ? goalDef(goal) : null;
  const parent = def ? victoryDef(def.victory) : null;

  return (
    <Modal
      visible={goal != null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grabber} />

            {def && parent ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.content}
              >
                <SectionHeader
                  title={def.title}
                  meta={`${parent.mark} ${parent.label} • the category is fixed`}
                  action={<RoundIconButton icon="close" size={34} onPress={onClose} />}
                />

                <GlassCard tone="sunken" sheen={false} style={styles.purpose}>
                  <Text style={styles.purposeText}>{def.description}</Text>
                </GlassCard>

                <Field
                  label="Your target"
                  value={value}
                  onChangeText={(next) => {
                    setValue(next.slice(0, MAX_TARGET));
                    if (error) setError(null);
                  }}
                  placeholder={def.defaultTarget}
                  icon="flag-outline"
                  error={error}
                  autoCapitalize="sentences"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />

                <View style={styles.group}>
                  <Text style={styles.groupLabel}>Examples</Text>
                  <View style={styles.examples}>
                    {def.examples.map((example) => (
                      <Chip
                        key={example}
                        label={example}
                        active={value.trim() === example}
                        accent={parent.accent}
                        onPress={() => {
                          setValue(example);
                          setError(null);
                        }}
                      />
                    ))}
                  </View>
                </View>

                <View
                  style={[styles.note, { backgroundColor: accentSoft[parent.accent] }]}
                >
                  <Text style={[styles.noteText, { color: accentColor[parent.accent] }]}>
                    Changing a target does not touch days you have already won.
                  </Text>
                </View>

                <Button label="Save target" icon="checkmark" onPress={handleSave} />
                <Button
                  label="Reset to default"
                  icon="refresh-outline"
                  variant="ghost"
                  onPress={handleReset}
                />
              </ScrollView>
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
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.hairlineStrong,
    marginBottom: 12,
  },
  content: {
    gap: 16,
    paddingBottom: 12,
  },
  purpose: {
    padding: 13,
  },
  purposeText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: palette.textMuted,
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
  examples: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  note: {
    padding: 11,
    borderRadius: radius.md,
  },
  noteText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
});
