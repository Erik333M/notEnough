import { Ionicons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../ui/Button';
import { SectionHeader } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';
import { useToast } from '../../ui/Toast';
import type { EventInput, EventSummary } from '../../api/events';
import { EventCard } from './EventCard';
import { EventForm } from './EventForm';
import type { Theme } from '../../theme/tokens';
import { useStyles, useTheme } from '../../theme/ThemeContext';

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
  unreachable = false,
  onOpenEvent,
  onCreate,
}: {
  events: EventSummary[];
  /** The list could not be fetched, which is not the same as having none. */
  unreachable?: boolean;
  onOpenEvent: (eventId: string) => void;
  onCreate: (input: EventInput) => Promise<{ ok: boolean; message?: string; id?: string }>;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <View style={styles.wrap}>
      <SectionHeader title="Events" />

      {unreachable ? (
        /*
         * Said in place rather than as a toast on the button. The toast only
         * appears after somebody has filled in a form and pressed save, by
         * which point they have concluded the feature does not work.
         */
        <GlassCard style={styles.offline}>
          <Ionicons name="cloud-offline-outline" size={16} color={theme.warning} />
          <View style={styles.offlineBody}>
            <Text style={styles.offlineTitle}>Cannot reach the server</Text>
            <Text style={styles.offlineCopy}>
              Events, teams and friends all live on the server, so none of them will work until it
              is reachable. Everything you track on your own is unaffected and still on this
              device. Settings shows the address being tried.
            </Text>
          </View>
        </GlassCard>
      ) : events.length === 0 && !open ? (
        <Text style={styles.empty}>
          A camp, a training week, a competition weekend. Set one up to split people into squads,
          run matches between them, and record whatever you want to count — goals, assists,
          cards, anything you name yourself — into a table and a leaderboard.
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

const makeStyles = (theme: Theme) => StyleSheet.create({
  wrap: { gap: 10 },
  empty: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: theme.textMuted },
  offline: { flexDirection: 'row', gap: 10, padding: 14 },
  offlineBody: { flex: 1, gap: 4 },
  offlineTitle: { fontSize: 13.5, fontWeight: '800', color: theme.warning },
  offlineCopy: { fontSize: 12, lineHeight: 17, fontWeight: '600', color: theme.textMuted },
  form: { gap: 12, padding: 14 },
});
