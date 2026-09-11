import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { JourneyHeaderBar } from '../features/journey/JourneyHeaderBar';
import { MovementPicker } from '../features/journey/MovementPicker';
import { WodLinesCard } from '../features/journey/WodLinesCard';
import { WodRoundsCard, WodTagsCard } from '../features/journey/WodMetaCards';
import { WodTextBlock } from '../features/journey/WodTextFields';
import { dayKey, longDateLabel } from '../lib/time';
import { useActions, useAppState } from '../state/DataContext';
import { entryFor } from '../state/journey/entries';
import { allMovements } from '../state/journey/movements';
import type {
  DayKey,
  Movement,
  MovementCategory,
  WodLine,
  WodRounds,
  WodTag,
} from '../state/journey/types';
import { radius } from '../theme/theme';
import { Appear } from '../ui/Controls';
import { SkeletonCard } from '../ui/Feedback';
import { GlassCard } from '../ui/Glass';

/**
 * The workout builder.
 *
 * Every field is optional, including the movement lines — a workout recorded
 * as nothing but "felt good, 20 minutes" in the result box is a valid entry.
 * Nothing here is scored or validated against a format, because the workbook
 * this models lets people write whatever they did.
 *
 * Empty lines are pruned when the screen closes, so tapping "add a line" and
 * changing your mind leaves nothing behind.
 */
export default function WodBuilderScreen({
  date,
  bottomInset,
  onBack,
  onBrowseMovements,
}: {
  date: DayKey;
  bottomInset: number;
  onBack: () => void;
  onBrowseMovements: () => void;
}) {
  const state = useAppState();
  const { journey } = useActions();

  /** Which line the picker is filling, or null when it is closed. */
  const [picking, setPicking] = useState<string | null>(null);

  const journeyState = state?.journey;
  const entry = useMemo(
    () => (journeyState ? entryFor(journeyState, date) : null),
    [journeyState, date],
  );
  const movements = useMemo(
    () => (journeyState ? allMovements(journeyState) : []),
    [journeyState],
  );

  // Leaving the screen is the moment to drop rows the user never filled in.
  useEffect(() => () => journey.pruneWodLines(date), [journey, date]);

  const handleTag = useCallback((tag: WodTag) => journey.toggleWodTag(date, tag), [journey, date]);

  const handleRounds = useCallback(
    (rounds: WodRounds) => journey.setWodRounds(date, rounds),
    [journey, date],
  );

  const handleAddLine = useCallback(() => journey.addWodLine(date), [journey, date]);

  const handleLineChange = useCallback(
    (id: string, patch: Partial<WodLine>) => journey.updateWodLine(date, id, patch),
    [journey, date],
  );

  const handleRemoveLine = useCallback(
    (id: string) => journey.removeWodLine(date, id),
    [journey, date],
  );

  const openPicker = useCallback((id: string) => setPicking(id), []);
  const closePicker = useCallback(() => setPicking(null), []);

  const handlePick = useCallback(
    (movement: Movement) => {
      if (!picking) return;
      // Keeps `freeText` in step so the line still reads correctly if the
      // movement is later deleted from the catalogue.
      journey.updateWodLine(date, picking, { movementId: movement.id, freeText: movement.name });
      setPicking(null);
    },
    [journey, date, picking],
  );

  const handleCreate = useCallback(
    (name: string, category: MovementCategory) => {
      if (!picking) return;
      const movement = journey.addMovement(name, category);
      journey.updateWodLine(date, picking, { movementId: movement.id, freeText: movement.name });
      setPicking(null);
    },
    [journey, date, picking],
  );

  const handleFreeText = useCallback(
    (text: string) => {
      if (!picking) return;
      journey.updateWodLine(date, picking, { movementId: null, freeText: text });
      setPicking(null);
    },
    [journey, date, picking],
  );

  const handleBrowse = useCallback(() => {
    setPicking(null);
    onBrowseMovements();
  }, [onBrowseMovements]);

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

  const wod = entry.wod;
  const lines = wod?.lines ?? [];
  const isToday = date === dayKey();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <JourneyHeaderBar
        title="Workout"
        meta={isToday ? 'Today' : longDateLabel(date)}
        onBack={onBack}
        backLabel="Back to the day"
        topic="wod"
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Appear>
          <WodTagsCard tags={wod?.tags ?? []} onToggle={handleTag} />
        </Appear>

        <Appear delay={50}>
          <WodRoundsCard rounds={wod?.rounds ?? null} onSelect={handleRounds} />
        </Appear>

        <Appear delay={100}>
          <WodLinesCard
            journey={journeyState}
            lines={lines}
            onAdd={handleAddLine}
            onPickMovement={openPicker}
            onChange={handleLineChange}
            onRemove={handleRemoveLine}
          />
        </Appear>

        <Appear delay={150}>
          <GlassCard style={styles.card}>
            <WodTextBlock
              date={date}
              field="structure"
              heading="HOW IT WAS SET UP"
              prompt="The format, in your own words"
              placeholder="3 rounds for time. 12 minutes, as many as possible."
              value={wod?.structure ?? ''}
            />
          </GlassCard>
        </Appear>

        <Appear delay={200}>
          <GlassCard style={styles.card}>
            <WodTextBlock
              date={date}
              field="result"
              heading="RESULT"
              prompt="However it was scored"
              placeholder="A time, a number of rounds, or how it felt"
              value={wod?.result ?? ''}
            />
          </GlassCard>
        </Appear>
      </ScrollView>

      <MovementPicker
        visible={picking !== null}
        movements={movements}
        onClose={closePicker}
        onPick={handlePick}
        onCreate={handleCreate}
        onPickFreeText={handleFreeText}
        onBrowseAll={handleBrowse}
      />
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
    gap: 10,
    borderRadius: radius.lg,
  },
});
