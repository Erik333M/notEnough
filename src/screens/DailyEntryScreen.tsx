import { useCallback, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { EntryTextBlock } from '../features/journey/EntryTextFields';
import { JourneyHeaderBar } from '../features/journey/JourneyHeaderBar';
import { IntentionCard } from '../features/journey/IntentionCard';
import { PlusOneCard } from '../features/journey/PlusOneCard';
import { WodCard } from '../features/journey/WodCard';
import { dayKey, longDateLabel, weekdayLabel } from '../lib/time';
import { useActions, useAppState } from '../state/DataContext';
import { entryFor, entryHasContent } from '../state/journey/entries';
import { activeHabits } from '../state/journey/habits';
import type { IntentionSlot } from '../state/journey/entryReducer';
import type { DayKey, PlusOneKey } from '../state/journey/types';
import { radius } from '../theme/theme';
import { Button } from '../ui/Button';
import { Appear } from '../ui/Controls';
import { SkeletonCard } from '../ui/Feedback';
import { GlassCard } from '../ui/Glass';
import { useToast } from '../ui/Toast';

/**
 * The full page for one date — today or any day in the past.
 *
 * Everything the workbook prints, with no required field but the date, which
 * comes from the strip that opened this screen. There is no Save button: each
 * field commits itself on a debounce, on blur, on unmount and on backgrounding
 * (see `useAutosaveText`), so leaving mid-sentence keeps the sentence.
 */
export default function DailyEntryScreen({
  date,
  bottomInset,
  onBack,
  onOpenWod,
}: {
  date: DayKey;
  bottomInset: number;
  onBack: () => void;
  onOpenWod: (date: DayKey) => void;
}) {
  const state = useAppState();
  const { journey } = useActions();
  const { notify } = useToast();

  const journeyState = state?.journey;
  const entry = useMemo(
    () => (journeyState ? entryFor(journeyState, date) : null),
    [journeyState, date],
  );

  const handleIntentionText = useCallback(
    (slot: IntentionSlot, text: string) => journey.setIntentionText(date, slot, text),
    [journey, date],
  );

  const handleIntentionDone = useCallback(
    (slot: IntentionSlot, current: boolean | null) =>
      journey.cycleIntentionDone(date, slot, current),
    [journey, date],
  );

  const handlePlusOne = useCallback(
    (key: PlusOneKey) => journey.togglePlusOne(date, key),
    [journey, date],
  );

  const handleClear = useCallback(() => {
    journey.clearEntry(date);
    notify('Day cleared.', 'info');
    onBack();
  }, [journey, date, notify, onBack]);

  if (!entry || !journeyState) {
    return (
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <SkeletonCard />
        <SkeletonCard delay={120} />
      </ScrollView>
    );
  }

  const isToday = date === dayKey();
  const hasContent = entryHasContent(entry);
  const habitTitles = activeHabits(journeyState).map((h) => h.title);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <JourneyHeaderBar
        title={longDateLabel(date)}
        meta={isToday ? 'Today' : weekdayLabel(date)}
        onBack={onBack}
        backLabel="Back to the journey home"
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Appear>
          <GlassCard style={styles.card}>
            <EntryTextBlock
              date={date}
              field="theme"
              label="Theme"
              prompt="A few words for what today is about"
              topic="theme"
              placeholder="Patience. Finish what I start."
              value={entry.theme}
              minLines={1}
              maxLength={120}
              icon="bookmark-outline"
              onCommit={journey.setEntryText}
            />
          </GlassCard>
        </Appear>

        <Appear delay={60}>
          <IntentionCard
            slot="decision"
            title="DECISION"
            intention={entry.decision}
            accent="amber"
            onChangeText={handleIntentionText}
            onCycleDone={handleIntentionDone}
          />
        </Appear>

        <Appear delay={100}>
          <IntentionCard
            slot="habit"
            title="HABIT"
            intention={entry.habit}
            accent="lime"
            onChangeText={handleIntentionText}
            onCycleDone={handleIntentionDone}
            suggestions={habitTitles}
          />
        </Appear>

        <Appear delay={140}>
          <PlusOneCard plusOne={entry.plusOne} onToggle={handlePlusOne} />
        </Appear>

        <Appear delay={170}>
          <WodCard date={date} wod={entry.wod} journey={journeyState} onOpen={onOpenWod} />
        </Appear>

        <Appear delay={180}>
          <GlassCard style={styles.card}>
            <EntryTextBlock
              date={date}
              field="skill"
              label="Skill"
              prompt="Something you practised on purpose"
              topic="skill"
              placeholder="A movement, an instrument, a language"
              value={entry.skill}
              onCommit={journey.setEntryText}
            />
          </GlassCard>
        </Appear>

        <Appear delay={220}>
          <GlassCard style={styles.card}>
            <EntryTextBlock
              date={date}
              field="story"
              label="Story / Scripture"
              prompt="Anything you read and want to keep"
              topic="story"
              placeholder="A passage, a quote, a line from a book"
              value={entry.story}
              onCommit={journey.setEntryText}
            />
          </GlassCard>
        </Appear>

        {hasContent ? (
          <Appear delay={260}>
            <Button
              label="Clear this day"
              icon="trash-outline"
              variant="danger"
              onPress={handleClear}
            />
          </Appear>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  card: {
    borderRadius: radius.lg,
  },
});
