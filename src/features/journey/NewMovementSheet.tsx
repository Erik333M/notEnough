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

import { MOVEMENT_CATEGORY_LABEL } from '../../state/journey/movements';
import { NO_MUSCLE_WORK, type MuscleWork } from '../../state/journey/muscles';
import type { MovementCategory } from '../../state/journey/types';
import { MusclePicker } from '../muscles/MusclePicker';
import { radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { Chip, RoundIconButton, SectionHeader } from '../../ui/Controls';
import { Field } from '../../ui/Field';
import type { Theme } from '../../theme/tokens';
import { useStyles, useTheme } from '../../theme/ThemeContext';

/**
 * Adds a movement to the user's own catalogue.
 *
 * Name, category, and what it works. None of the three blocks saving: the
 * point is to get back to logging the workout, and a movement with no muscles
 * on it is still a movement.
 *
 * The muscles are asked for here because this is the one moment somebody knows
 * the answer — they have just thought of the exercise. Tagging it later means
 * finding it again in a list of hundreds.
 */
type Props = {
  visible: boolean;
  /** Prefills from whatever was being searched when this was opened. */
  initialName?: string;
  onClose: () => void;
  onCreate: (name: string, category: MovementCategory, muscles: MuscleWork) => void;
};

const CATEGORIES = Object.keys(MOVEMENT_CATEGORY_LABEL) as MovementCategory[];

export function NewMovementSheet({ visible, initialName = '', onClose, onCreate }: Props) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MovementCategory>('strength');
  const [muscles, setMuscles] = useState<MuscleWork>(NO_MUSCLE_WORK);
  const [error, setError] = useState<string | null>(null);

  // Reset on open so a cancelled entry never leaks into the next one.
  useEffect(() => {
    if (!visible) return;
    setName(initialName);
    setCategory('strength');
    setMuscles(NO_MUSCLE_WORK);
    setError(null);
  }, [visible, initialName]);

  const handleSave = useCallback(() => {
    const clean = name.trim();
    if (clean.length < 2) {
      setError('Give the movement a name.');
      return;
    }
    onCreate(clean, category, muscles);
  }, [name, category, muscles, onCreate]);

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
          <ScrollView
            style={styles.sheet}
            contentContainerStyle={[styles.sheetBody, { paddingBottom: insets.bottom + 16 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.grabber} />

            <SectionHeader
              title="New movement"
              meta="Yours, and only on this account"
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
              placeholder="Sled push"
              icon="barbell-outline"
              error={error}
              autoCapitalize="sentences"
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <View style={styles.group}>
              <Text style={styles.groupLabel}>Category</Text>
              <View style={styles.chips}>
                {CATEGORIES.map((key) => (
                  <Chip
                    key={key}
                    label={MOVEMENT_CATEGORY_LABEL[key]}
                    active={category === key}
                    accent="mind"
                    onPress={() => setCategory(key)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.group}>
              <Text style={styles.groupLabel}>What does it work?</Text>
              <MusclePicker work={muscles} onChange={setMuscles} />
            </View>

            <Button label="Add movement" icon="checkmark" onPress={handleSave} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.scrim,
  },
  sheetWrap: {
    maxHeight: '92%',
  },
  sheet: {
    backgroundColor: theme.surfaceElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.borderStrong,
  },
  // Gap lives on the scrolling content now that the sheet is a ScrollView;
  // a gap on the scroller itself is ignored.
  sheetBody: {
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 16,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.borderStrong,
  },
  group: {
    gap: 8,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textMuted,
    marginLeft: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
