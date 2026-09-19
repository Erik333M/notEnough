import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { SectionHeader } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';
import { useToast } from '../../ui/Toast';
import type { EventInput, EventSummary } from '../../api/events';
import { EventCard } from './EventCard';
import { EventForm } from './EventForm';

/**
 * Events on the Teams tab.
 *
 * Not a sixth tab. An event *is* a team — the same roster, the same codes, the
 * same roles — so it belongs on the screen that already lists the groups you
 * are part of, above the squads because an event is the one with a date
 * running out.
 *
 * Its own component for length, but the data lives one level up: the screen
 * around it needs the count to decide whether it is empty, and two hooks
 * fetching the same list would be two answers to one question.
 */
export const EventsSection = memo(function EventsSection({
  events,
  onOpenEvent,
  onCreate,
}: {
  events: EventSummary[];
  onOpenEvent: (eventId: string) => void;
  onCreate: (input: EventInput) => Promise<{ ok: boolean; message?: string; id?: string }>;
}) {
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <View style={styles.wrap}>
      <SectionHeader title="Events" />

      {events.length === 0 && !open ? (
        <Text style={styles.empty}>
          A camp, a training week, a competition weekend. Anything that runs for a set number of days
          with people to organise.
        </Text>
      ) : null}

      {events.map((summary) => (
        <EventCard
          key={summary.event.id}
          summary={summary}
          onOpen={() => onOpenEvent(summary.event.id)}
        />
      ))}

      {open ? (
        <GlassCard style={styles.form}>
          <EventForm
            submitLabel="Create the event"
            busy={busy}
            onSubmit={async (input) => {
              setBusy(true);
              const result = await onCreate(input);
              setBusy(false);
              if (result.ok && result.id) {
                setOpen(false);
                notify(`${input.name} is set up. Share the code to fill it.`, 'success');
                onOpenEvent(result.id);
              } else {
                notify(result.message ?? 'That did not save.', 'error');
              }
            }}
          />
          <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
        </GlassCard>
      ) : (
        <Button
          label="Set up an event"
          icon="calendar-outline"
          variant="ghost"
          onPress={() => setOpen(true)}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  empty: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
  form: { gap: 12, padding: 14 },
});
