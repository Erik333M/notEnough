import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { IntentionSlot } from '../../state/journey/entryReducer';
import type { Intention } from '../../state/journey/types';
import { accentColor, palette, radius, type AccentName } from '../../theme/theme';
import { Chip } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';
import { PressableScale } from '../../ui/Touchable';
import { InfoTip } from './InfoTip';
import { useAutosaveText } from './useAutosaveText';

/**
 * One "I will…" line with its Done answer.
 *
 * Decision and Habit are the same shape on the page and behave identically, so
 * they are one component. Both are optional: an empty card is a valid day.
 */
type Props = {
  slot: IntentionSlot;
  title: string;
  intention: Intention;
  accent: AccentName;
  onChangeText: (slot: IntentionSlot, text: string) => void;
  onCycleDone: (slot: IntentionSlot, current: boolean | null) => void;
  /**
   * One-tap fills, offered only while the line is empty.
   *
   * Used to bridge the two things the workbook calls "habit": the standing
   * habits with streaks, and this single line for today. They stay separate
   * records — this just saves retyping one into the other.
   */
  suggestions?: string[];
};

const MAX = 120;

/**
 * Yes / No / unanswered.
 *
 * The workbook prints Yes and No as two boxes, and "unanswered" is the state
 * you are in all day until you decide. Making it a third state — rather than
 * defaulting to No — is what keeps an unfinished day from reading as a failed
 * one. Tapping cycles, so a mistap costs two taps to undo rather than being
 * stuck.
 */
const DoneToggle = memo(function DoneToggle({
  done,
  label,
  onPress,
}: {
  done: boolean | null;
  label: string;
  onPress: () => void;
}) {
  const state = done === null ? 'not answered' : done ? 'yes' : 'no';
  const tint = done === null ? palette.textFaint : done ? accentColor.lime : accentColor.rose;

  return (
    <PressableScale
      onPress={onPress}
      haptic={done === null ? 'medium' : 'light'}
      scaleTo={0.92}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${state}. Tap to change.`}
      style={styles.doneWrap}
    >
      <View style={[styles.done, { borderColor: tint }]}>
        <Ionicons
          name={done === null ? 'ellipse-outline' : done ? 'checkmark-sharp' : 'close-sharp'}
          size={18}
          color={tint}
        />
      </View>
      <Text style={[styles.doneLabel, { color: tint }]}>
        {done === null ? 'Done?' : done ? 'Yes' : 'No'}
      </Text>
    </PressableScale>
  );
});

export const IntentionCard = memo(function IntentionCard({
  slot,
  title,
  intention,
  accent,
  onChangeText,
  onCycleDone,
  suggestions,
}: Props) {
  const commit = useCallback(
    (text: string) => onChangeText(slot, text),
    [onChangeText, slot],
  );

  const { draft, onChangeText: onType, flush } = useAutosaveText(intention.text, commit);

  const handleCycle = useCallback(
    () => onCycleDone(slot, intention.done),
    [intention.done, onCycleDone, slot],
  );

  // Only while the line is blank: once something is written, chips would be
  // clutter offering to overwrite it.
  const offers = draft.trim().length === 0 ? (suggestions ?? []) : [];

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: accentColor[accent] }]}>{title}</Text>
        <InfoTip topic={slot} />
      </View>

      <View style={styles.row}>
        <View style={styles.inputWrap}>
          <Text style={styles.prefix}>I will…</Text>
          <TextInput
            value={draft}
            onChangeText={onType}
            onBlur={flush}
            placeholder="Leave blank if today has no one thing"
            placeholderTextColor={palette.textFaint}
            style={styles.input}
            maxLength={MAX}
            autoCapitalize="sentences"
            returnKeyType="done"
            selectionColor={palette.violet}
            accessibilityLabel={`${title}: what will you do?`}
            multiline
          />
        </View>

        <DoneToggle done={intention.done} label={title} onPress={handleCycle} />
      </View>

      {offers.length > 0 ? (
        <View style={styles.offers}>
          {offers.map((offer) => (
            <Chip
              key={offer}
              label={offer}
              active={false}
              accent={accent}
              onPress={() => onChangeText(slot, offer)}
            />
          ))}
        </View>
      ) : null}
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  title: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  inputWrap: {
    flex: 1,
    gap: 3,
  },
  prefix: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textFaint,
  },
  input: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: palette.text,
    padding: 0,
    minHeight: 42,
  },
  doneWrap: {
    width: 52,
    alignItems: 'center',
    gap: 5,
    paddingTop: 2,
  },
  done: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
    backgroundColor: palette.glassSunken,
  },
  doneLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  offers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
