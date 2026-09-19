import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EventForm } from '../features/events/EventForm';
import { EventRosterSection } from '../features/events/EventRosterSection';
import { ageLabel, durationLabel, formatRange, phaseLabel } from '../features/events/eventCopy';
import { useEventDetail } from '../features/events/useEventDetail';
import { InviteCard } from '../features/teams/InviteCard';
import { accentColor, palette } from '../theme/theme';
import { Appear, Pill, SectionHeader, StatTile } from '../ui/Controls';
import { Button } from '../ui/Button';
import { GlassCard } from '../ui/Glass';
import { StackHeaderBar } from '../ui/StackHeaderBar';
import { useToast } from '../ui/Toast';

/**
 * One event: when it runs, who is there, and — for staff — the controls.
 *
 * A camper and a staff member see the same page. What differs is what is
 * actionable on it, which is decided by the role the server sent back rather
 * than by anything this screen works out for itself.
 */
export default function EventDetailScreen({
  eventId,
  bottomInset,
  onBack,
}: {
  eventId: string;
  bottomInset: number;
  onBack: () => void;
}) {
  const detail = useEventDetail(eventId);
  const { notify } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (detail.loading) {
    return (
      <View style={styles.centre}>
        <Text style={styles.quiet}>Loading…</Text>
      </View>
    );
  }

  if (!detail.data) {
    return (
      <View style={styles.centre}>
        <Text style={styles.quiet}>{detail.error ?? 'That event is not available.'}</Text>
        <Button label="Back" variant="ghost" onPress={onBack} />
      </View>
    );
  }

  const { event, team, counts, days, roster } = detail.data;
  const ages = ageLabel(event.ageMin, event.ageMax);
  const full = counts.campers >= event.capacity;

  return (
    <View style={styles.screen}>
      <StackHeaderBar
        title={team.name}
        meta={`${formatRange(event.startDate, event.endDate)} · ${durationLabel(days)}`}
        onBack={onBack}
        backLabel="Back to your teams"
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await detail.refresh();
              setRefreshing(false);
            }}
            tintColor={palette.textMuted}
          />
        }
      >
        <Appear>
          <GlassCard style={styles.head}>
            <View style={styles.pills}>
              <Pill label={phaseLabel(event.startDate, event.endDate)} icon="time-outline" accent="cyan" />
              {ages ? <Pill label={ages} icon="person-outline" accent="violet" /> : null}
              {full ? <Pill label="Full" icon="alert-circle-outline" accent="amber" /> : null}
            </View>

            <View style={styles.tiles}>
              <StatTile label="campers" value={`${counts.campers}/${event.capacity}`} accent="lime" />
              <StatTile label="staff" value={`${counts.staff}/${event.staffTarget}`} accent="violet" />
              <StatTile label="days" value={String(days)} accent="cyan" />
            </View>

            {counts.staff < event.staffTarget ? (
              <Text style={styles.warn}>
                {event.staffTarget - counts.staff} more staff needed. Anyone who has joined can be
                made staff below.
              </Text>
            ) : null}
          </GlassCard>
        </Appear>

        {detail.isStaff ? (
          <Appear delay={50}>
            <SectionHeader title="How people join" />
            <InviteCard code={team.inviteCode} />
            <Text style={styles.note}>
              One code for everybody, staff included. A full event puts new arrivals on the waiting
              list instead of turning them away — and making somebody staff lets them in, because
              staff never take a camper's place.
            </Text>
          </Appear>
        ) : null}

        <Appear delay={100}>
          <EventRosterSection
            roster={roster}
            isStaff={detail.isStaff}
            busy={detail.busy}
            myId={detail.myId}
            onSetMember={async (userId, change) => {
              const result = await detail.setMember(userId, change);
              if (!result.ok && result.message) notify(result.message, 'error');
            }}
          />
        </Appear>

        {detail.isStaff ? (
          <Appear delay={150}>
            <SectionHeader title="Settings" />
            {editing ? (
              <GlassCard style={styles.form}>
                <EventForm
                  initial={{
                    name: team.name,
                    startDate: event.startDate,
                    endDate: event.endDate,
                    ageMin: event.ageMin,
                    ageMax: event.ageMax,
                    capacity: event.capacity,
                    staffTarget: event.staffTarget,
                  }}
                  submitLabel="Save changes"
                  busy={saving}
                  onSubmit={async (input) => {
                    setSaving(true);
                    const result = await detail.update(input);
                    setSaving(false);
                    if (result.ok) {
                      setEditing(false);
                      notify('Event updated.', 'success');
                    } else {
                      notify(result.message, 'error');
                    }
                  }}
                />
                <Button label="Cancel" variant="ghost" onPress={() => setEditing(false)} />
              </GlassCard>
            ) : (
              <Button
                label="Edit the event"
                icon="create-outline"
                variant="ghost"
                onPress={() => setEditing(true)}
              />
            )}
          </Appear>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  quiet: { fontSize: 13, fontWeight: '600', color: palette.textMuted },
  content: { padding: 18, gap: 16 },
  head: { gap: 12, padding: 16 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tiles: { flexDirection: 'row', gap: 10 },
  warn: { fontSize: 12, lineHeight: 17, fontWeight: '700', color: accentColor.amber },
  note: { fontSize: 11.5, lineHeight: 17, fontWeight: '600', color: palette.textFaint },
  form: { gap: 12, padding: 14 },
});
