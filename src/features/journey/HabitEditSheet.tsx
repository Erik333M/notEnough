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

import { HABIT_GROUP_LABEL } from '../../state/journey/habits';
import type { Habit } from '../../state/journey/types';
import { palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { RoundIconButton, SectionHeader } from '../../ui/Controls';
import { Field } from '../../ui/Field';

/**
 * Rename or drop a habit.
 *
 * Dropping archives rather than deletes: the ticks stay attached to the days
 * they happened on, so a habit you stop doing never rewrites your history. The
 * copy says "stop tracking" for that reason — it is not a delete, and calling
 * it one would be a lie.
 */
type Props = {
  habit: Habit | null;
  onClose: () => void;
  onRename: (id: string, title: string) => void;
  onArchive: (id: string) => void;
};

export function HabitEditSheet({ habit, onClose, onRename, onArchive }: Props) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!habit) return;
    setTitle(habit.title);
    setError(null);
  }, [habit]);

  const handleSave = useCallback(() => {
    if (!habit) return;
    const clean = title.trim();
    if (clean.length < 2) {
      setError('Give the habit a name.');
      return;
    }
    onRename(habit.id, clean);
  }, [habit, title, onRename]);

  const handleArchive = useCallback(() => {
    if (habit) onArchive(habit.id);
  }, [habit, onArchive]);

  return (
    <Modal
      visible={habit != null}
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

            {habit ? (
              <>
                <SectionHeader
                  title="Edit habit"
                  meta={HABIT_GROUP_LABEL[habit.group]}
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
                  value={title}
                  onChangeText={(next) => {
                    setTitle(next);
                    if (error) setError(null);
                  }}
                  placeholder="What are you trying to repeat?"
                  icon="repeat-outline"
                  error={error}
                  autoCapitalize="sentences"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />

                <Button label="Save" icon="checkmark" onPress={handleSave} />

                <Text style={styles.note}>
                  Stopping a habit keeps every day you already ticked.
                </Text>

                <Button
                  label="Stop tracking this"
                  icon="archive-outline"
                  variant="danger"
                  onPress={handleArchive}
                />
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
    gap: 14,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.hairlineStrong,
  },
  note: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: palette.textFaint,
    textAlign: 'center',
  },
});
