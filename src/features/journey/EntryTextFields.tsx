import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { EntryTextField } from '../../state/journey/entryReducer';
import type { DayKey } from '../../state/journey/types';
import { palette } from '../../theme/theme';
import { TextArea } from '../../ui/Field';
import { InfoTip } from './InfoTip';
import type { ExplainerKey } from './journeyCopy';
import { useAutosaveText } from './useAutosaveText';

/**
 * The free-text parts of a day: theme, skill and story.
 *
 * All three are the same control at different heights, and all three are
 * optional. They carry no Save button — `useAutosaveText` commits on a pause,
 * on blur, on unmount and on backgrounding.
 */
type FieldProps = {
  date: DayKey;
  field: EntryTextField;
  label: string;
  /** Sentence shown above the box, phrased as the question being asked. */
  prompt: string;
  topic: ExplainerKey;
  placeholder: string;
  value: string;
  minLines?: number;
  maxLength?: number;
  icon?: keyof typeof Ionicons.glyphMap;
  onCommit: (date: DayKey, field: EntryTextField, value: string) => void;
};

export const EntryTextBlock = memo(function EntryTextBlock({
  date,
  field,
  label,
  prompt,
  topic,
  placeholder,
  value,
  minLines = 3,
  maxLength = 500,
  icon,
  onCommit,
}: FieldProps) {
  const commit = useCallback(
    (next: string) => onCommit(date, field, next),
    [date, field, onCommit],
  );

  const { draft, onChangeText, flush } = useAutosaveText(value, commit);

  return (
    <View style={styles.group}>
      <View style={styles.header}>
        {icon ? <Ionicons name={icon} size={14} color={palette.textFaint} /> : null}
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        <InfoTip topic={topic} />
      </View>
      <TextArea
        label={prompt}
        value={draft}
        onChangeText={onChangeText}
        onBlur={flush}
        placeholder={placeholder}
        minLines={minLines}
        maxLength={maxLength}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  group: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: palette.textMuted,
  },
});
