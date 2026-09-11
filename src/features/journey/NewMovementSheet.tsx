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

import { MOVEMENT_CATEGORY_LABEL } from '../../state/journey/movements';
import type { MovementCategory } from '../../state/journey/types';
import { palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { Chip, RoundIconButton, SectionHeader } from '../../ui/Controls';
import { Field } from '../../ui/Field';

/**
 * Adds a movement to the user's own catalogue.
 *
 * Two fields and nothing else. The category only affects filtering, so it has
 * a sensible default and never blocks saving — the point is to get back to
 * logging the workout.
 */
type Props = {
  visible: boolean;
  /** Prefills from whatever was being searched when this was opened. */
  initialName?: string;
  onClose: () => void;
  onCreate: (name: string, category: MovementCategory) => void;
};

const CATEGORIES = Object.keys(MOVEMENT_CATEGORY_LABEL) as MovementCategory[];

export function NewMovementSheet({ visible, initialName = '', onClose, onCreate }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MovementCategory>('strength');
  const [error, setError] = useState<string | null>(null);

  // Reset on open so a cancelled entry never leaks into the next one.
  useEffect(() => {
    if (!visible) return;
    setName(initialName);
    setCategory('strength');
    setError(null);
  }, [visible, initialName]);

  const handleSave = useCallback(() => {
    const clean = name.trim();
    if (clean.length < 2) {
      setError('Give the movement a name.');
      return;
    }
    onCreate(clean, category);
  }, [name, category, onCreate]);

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
                    accent="cyan"
                    onPress={() => setCategory(key)}
                  />
                ))}
              </View>
            </View>

            <Button label="Add movement" icon="checkmark" onPress={handleSave} />
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
});
