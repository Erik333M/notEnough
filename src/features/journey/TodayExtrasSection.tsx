import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { DayKey, JourneyState, Wod } from '../../state/journey/types';
import { Button } from '../../ui/Button';
import { Appear, SectionHeader } from '../../ui/Controls';
import { WodCard } from './WodCard';

/**
 * The optional half of today: the workout, and the way into the full page.
 *
 * Held behind its own heading — "only if you want it" — so the three cards
 * above it stay the whole of what a first-time user is asked for. The workout
 * card is withheld entirely until a day has been written, which keeps day one
 * at exactly three cards.
 */
type Props = {
  date: DayKey;
  wod: Wod | null;
  journey: JourneyState;
  /** True before anything at all has been logged. */
  firstTime: boolean;
  onOpenWod: (date: DayKey) => void;
  onOpenEntry: () => void;
};

export const TodayExtrasSection = memo(function TodayExtrasSection({
  date,
  wod,
  journey,
  firstTime,
  onOpenWod,
  onOpenEntry,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Appear delay={210}>
        <SectionHeader title="More on today" meta="Only if you want it" />
      </Appear>

      {firstTime ? null : (
        <Appear delay={240}>
          <WodCard date={date} wod={wod} journey={journey} onOpen={onOpenWod} />
        </Appear>
      )}

      <Appear delay={250}>
        <Button
          label="Open the full page"
          icon="create-outline"
          variant="glass"
          onPress={onOpenEntry}
        />
      </Appear>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
});
