import { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MUSCLE_GROUPS,
  MUSCLE_LABEL,
  type MuscleGroup,
  type MuscleWork,
} from '../../state/journey/muscles';
import { accentColor, palette, radius } from '../../theme/theme';
import { PressableScale } from '../../ui/Touchable';

/**
 * Saying what a movement works.
 *
 * One grid, and each tap moves a muscle round a three-step cycle: nothing →
 * mainly → also → nothing. A separate "primary" and "secondary" list would be
 * two controls for one idea, and would make the common case — three taps for
 * three muscles — into a mode switch.
 *
 * The three states are told apart by fill, by border and by a word, not by
 * colour alone. Somebody who cannot separate the two reds still reads the
 * label underneath.
 */
const NEXT: Record<'none' | 'primary' | 'secondary', 'none' | 'primary' | 'secondary'> = {
  none: 'primary',
  primary: 'secondary',
  secondary: 'none',
};

export const MusclePicker = memo(function MusclePicker({
  work,
  onChange,
}: {
  work: MuscleWork;
  onChange: (next: MuscleWork) => void;
}) {
  const stateOf = useCallback(
    (group: MuscleGroup): 'none' | 'primary' | 'secondary' =>
      work.primary.includes(group) ? 'primary' : work.secondary.includes(group) ? 'secondary' : 'none',
    [work],
  );

  const cycle = useCallback(
    (group: MuscleGroup) => {
      const next = NEXT[stateOf(group)];
      // Rebuilt from scratch each time so a group can never end up in both
      // lists, which would shade it twice and read as a bug on the figure.
      const primary = work.primary.filter((row) => row !== group);
      const secondary = work.secondary.filter((row) => row !== group);
      if (next === 'primary') primary.push(group);
      if (next === 'secondary') secondary.push(group);
      onChange({ primary, secondary });
    },
    [onChange, stateOf, work],
  );

  const chosen = work.primary.length + work.secondary.length;

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        {chosen === 0
          ? 'Tap what it works. Tap again for muscles it only helps with.'
          : `${work.primary.length} mainly, ${work.secondary.length} also`}
      </Text>

      <View style={styles.grid}>
        {MUSCLE_GROUPS.map((group) => {
          const state = stateOf(group);
          return (
            <PressableScale
              key={group}
              haptic="light"
              scaleTo={0.94}
              onPress={() => cycle(group)}
              accessibilityLabel={`${MUSCLE_LABEL[group]}: ${
                state === 'none' ? 'not worked' : state === 'primary' ? 'mainly' : 'also'
              }`}
            >
              <View
                style={[
                  styles.chip,
                  state === 'primary' && styles.chipPrimary,
                  state === 'secondary' && styles.chipSecondary,
                ]}
              >
                <Text
                  style={[
                    styles.label,
                    state === 'primary' && styles.labelPrimary,
                    state === 'secondary' && styles.labelSecondary,
                  ]}
                >
                  {MUSCLE_LABEL[group]}
                </Text>
                {state !== 'none' ? (
                  <Text style={[styles.tag, state === 'primary' && styles.tagPrimary]}>
                    {state === 'primary' ? 'mainly' : 'also'}
                  </Text>
                ) : null}
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  hint: { fontSize: 11.5, lineHeight: 16, fontWeight: '600', color: palette.textFaint },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.hairline,
    backgroundColor: palette.glass,
  },
  chipPrimary: { backgroundColor: accentColor.rose, borderColor: accentColor.rose },
  chipSecondary: { borderColor: accentColor.rose, backgroundColor: 'rgba(255,122,143,0.18)' },
  label: { fontSize: 12.5, fontWeight: '700', color: palette.textMuted },
  labelPrimary: { color: palette.onAccent, fontWeight: '800' },
  labelSecondary: { color: palette.text },
  tag: { fontSize: 9.5, fontWeight: '800', color: palette.text, textTransform: 'uppercase' },
  tagPrimary: { color: palette.onAccent },
});
