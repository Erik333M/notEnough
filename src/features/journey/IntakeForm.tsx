import { memo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Intake } from '../../state/journey/types';
import { palette } from '../../theme/theme';
import { Chip } from '../../ui/Controls';
import { Field, TextArea } from '../../ui/Field';

/**
 * The baseline questions.
 *
 * Every field is optional and there is no validation beyond length caps —
 * refusing to save because someone left a box blank would defeat the point.
 * The order runs from harmless to sensitive, so anyone who stops halfway has
 * only answered the easy ones.
 *
 * Nothing here logs a value, and the answers go to SecureStore through
 * `useIntake`, never into the synced app state.
 */
type Props = {
  value: Intake;
  onChange: (next: Intake) => void;
};

const DAYS = [1, 2, 3, 4, 5, 6, 7];

export const IntakeForm = memo(function IntakeForm({ value, onChange }: Props) {
  const [days, setDays] = useState<number | null>(value.daysPerWeek);

  const patch = useCallback(
    (next: Partial<Intake>) => onChange({ ...value, ...next }),
    [onChange, value],
  );

  const handleDays = useCallback(
    (next: number) => {
      const chosen = days === next ? null : next;
      setDays(chosen);
      patch({ daysPerWeek: chosen });
    },
    [days, patch],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.group}>
        <Text style={styles.label}>Are you training at the moment?</Text>
        <View style={styles.chips}>
          <Chip
            label="Yes"
            active={value.currentlyTraining === true}
            accent="lime"
            onPress={() =>
              patch({ currentlyTraining: value.currentlyTraining === true ? null : true })
            }
          />
          <Chip
            label="Not right now"
            active={value.currentlyTraining === false}
            accent="violet"
            onPress={() =>
              patch({ currentlyTraining: value.currentlyTraining === false ? null : false })
            }
          />
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Days a week, roughly</Text>
        <View style={styles.chips}>
          {DAYS.map((day) => (
            <Chip
              key={day}
              label={`${day}`}
              active={days === day}
              accent="cyan"
              onPress={() => handleDays(day)}
            />
          ))}
        </View>
      </View>

      <Field
        label="Sports you play"
        value={value.sports}
        onChangeText={(next) => patch({ sports: next })}
        placeholder="Football, climbing, none"
        icon="football-outline"
        autoCapitalize="sentences"
        returnKeyType="done"
      />

      <TextArea
        label="Any injuries worth knowing about?"
        value={value.injuries}
        onChangeText={(next) => patch({ injuries: next })}
        placeholder="Leave blank if none"
        minLines={2}
        maxLength={400}
        accessibilityHint="Optional. Stored only on this device."
      />

      <TextArea
        label="Any medical conditions worth knowing about?"
        value={value.medicalConditions}
        onChangeText={(next) => patch({ medicalConditions: next })}
        placeholder="Leave blank if none"
        minLines={2}
        maxLength={400}
        accessibilityHint="Optional. Stored only on this device."
      />

      <View style={styles.group}>
        <Text style={styles.label}>Emergency contact</Text>
        <Text style={styles.hint}>
          Someone to call if you get hurt training. Only ever shown on this phone.
        </Text>
        <Field
          label="Name"
          value={value.emergencyContactName}
          onChangeText={(next) => patch({ emergencyContactName: next })}
          placeholder="Leave blank to skip"
          icon="person-outline"
          autoCapitalize="words"
          returnKeyType="next"
        />
        <Field
          label="Phone"
          value={value.emergencyContactPhone}
          onChangeText={(next) => patch({ emergencyContactPhone: next })}
          placeholder="Leave blank to skip"
          icon="call-outline"
          keyboardType="phone-pad"
          returnKeyType="done"
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: 18,
  },
  group: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
    marginLeft: 2,
  },
  hint: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: palette.textFaint,
    marginLeft: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
