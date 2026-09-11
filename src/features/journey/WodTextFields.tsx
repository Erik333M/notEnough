import { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useActions } from '../../state/DataContext';
import type { WodTextField } from '../../state/journey/entryReducer';
import type { DayKey } from '../../state/journey/types';
import { palette } from '../../theme/theme';
import { TextArea } from '../../ui/Field';
import { useAutosaveText } from './useAutosaveText';

/**
 * The workout's two free-text boxes: how it was set up, and how it went.
 *
 * Both are deliberately unstructured. "3 rounds for time", "AMRAP 12" and
 * "just messed about for half an hour" are all valid, and a result of "11:42",
 * "6 rounds + 4 reps" or "felt awful" all record equally well. Parsing these
 * into fields would force every user into one gym's vocabulary.
 */
type Props = {
  date: DayKey;
  field: WodTextField;
  /** Uppercase section heading. */
  heading: string;
  /** The question being asked, above the box — never a repeat of the heading. */
  prompt: string;
  placeholder: string;
  value: string;
};

export const WodTextBlock = memo(function WodTextBlock({
  date,
  field,
  heading,
  prompt,
  placeholder,
  value,
}: Props) {
  const { journey } = useActions();

  const commit = useCallback(
    (next: string) => journey.setWodText(date, field, next),
    [journey, date, field],
  );

  const { draft, onChangeText, flush } = useAutosaveText(value, commit);

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{heading}</Text>
      <TextArea
        label={prompt}
        value={draft}
        onChangeText={onChangeText}
        onBlur={flush}
        placeholder={placeholder}
        minLines={2}
        maxLength={120}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  group: {
    gap: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: palette.textMuted,
  },
});
