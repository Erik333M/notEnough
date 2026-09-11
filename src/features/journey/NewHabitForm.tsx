import { memo, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { HABIT_GROUP_LABEL } from '../../state/journey/habits';
import type { HabitGroup } from '../../state/journey/types';
import { Button } from '../../ui/Button';
import { Chip } from '../../ui/Controls';
import { Field } from '../../ui/Field';

/**
 * Write your own habit.
 *
 * Sits above the suggestions rather than below them: the templates are a
 * starting point for people who want one, not the expected path. Anyone who
 * already knows what they are trying to build should not have to scroll past
 * sixteen suggestions to type it.
 */
const GROUPS = Object.keys(HABIT_GROUP_LABEL) as HabitGroup[];

export const NewHabitForm = memo(function NewHabitForm({
  onCreate,
}: {
  onCreate: (title: string, group: HabitGroup) => void;
}) {
  const [title, setTitle] = useState('');
  const [group, setGroup] = useState<HabitGroup>('health');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(() => {
    const clean = title.trim();
    if (clean.length < 2) {
      setError('Give the habit a name.');
      return;
    }
    onCreate(clean, group);
  }, [title, group, onCreate]);

  return (
    <View style={styles.wrap}>
      <Field
        label="Your own"
        value={title}
        onChangeText={(next) => {
          setTitle(next);
          if (error) setError(null);
        }}
        placeholder="Ten minutes outside"
        icon="create-outline"
        error={error}
        autoCapitalize="sentences"
        returnKeyType="done"
        onSubmitEditing={handleCreate}
      />

      <View style={styles.chips}>
        {GROUPS.map((key) => (
          <Chip
            key={key}
            label={HABIT_GROUP_LABEL[key]}
            active={group === key}
            accent="lime"
            onPress={() => setGroup(key)}
          />
        ))}
      </View>

      <Button label="Add this habit" icon="add" onPress={handleCreate} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
