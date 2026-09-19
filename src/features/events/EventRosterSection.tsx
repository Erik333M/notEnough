import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { RosterEntry } from '../../api/teams';
import { accentColor, palette, radius } from '../../theme/theme';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { SectionHeader } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';

/**
 * Who is at the event, in the three groups that matter.
 *
 * Staff, campers, and the people waiting for a place. They are separated
 * because an organiser looks at this screen with one of three questions in
 * mind — have I enough adults, is it full, and who can I let in — and a single
 * alphabetical list answers none of them.
 */
export const EventRosterSection = memo(function EventRosterSection({
  roster,
  isStaff,
  busy,
  myId,
  onSetMember,
}: {
  roster: RosterEntry[];
  isStaff: boolean;
  busy: string | null;
  myId: string | null;
  onSetMember: (userId: string, change: { role?: 'coach' | 'athlete'; status?: 'active' }) => void;
}) {
  const staff = roster.filter((row) => row.role === 'coach');
  const campers = roster.filter((row) => row.role === 'athlete' && row.status === 'active');
  const waiting = roster.filter((row) => row.role === 'athlete' && row.status === 'pending');

  return (
    <View style={styles.wrap}>
      {waiting.length > 0 ? (
        <View style={styles.group}>
          <SectionHeader title={`Waiting for a place (${waiting.length})`} />
          {/*
            Shown to everybody, not only staff: somebody on this list needs to
            see that they are on it, or a full camp looks like a broken join.
          */}
          <GlassCard style={styles.card}>
            {waiting.map((row) => (
              <Person
                key={row.userId}
                entry={row}
                isYou={row.userId === myId}
                note="Waiting"
                busy={busy === row.userId}
                actions={
                  isStaff
                    ? [
                        { label: 'Admit', onPress: () => onSetMember(row.userId, { status: 'active' }) },
                        {
                          label: 'Make staff',
                          ghost: true,
                          onPress: () => onSetMember(row.userId, { role: 'coach' }),
                        },
                      ]
                    : []
                }
              />
            ))}
          </GlassCard>
        </View>
      ) : null}

      <View style={styles.group}>
        <SectionHeader title={`Staff (${staff.length})`} />
        <GlassCard style={styles.card}>
          {staff.map((row) => (
            <Person
              key={row.userId}
              entry={row}
              isYou={row.userId === myId}
              busy={busy === row.userId}
              actions={
                isStaff && staff.length > 1
                  ? [
                      {
                        label: 'Step down',
                        ghost: true,
                        onPress: () => onSetMember(row.userId, { role: 'athlete' }),
                      },
                    ]
                  : []
              }
            />
          ))}
        </GlassCard>
      </View>

      <View style={styles.group}>
        <SectionHeader title={`Campers (${campers.length})`} />
        {campers.length === 0 ? (
          <Text style={styles.empty}>Nobody has joined yet. Share the code.</Text>
        ) : (
          <GlassCard style={styles.card}>
            {campers.map((row) => (
              <Person
                key={row.userId}
                entry={row}
                isYou={row.userId === myId}
                busy={busy === row.userId}
                actions={
                  isStaff
                    ? [
                        {
                          label: 'Make staff',
                          ghost: true,
                          onPress: () => onSetMember(row.userId, { role: 'coach' }),
                        },
                      ]
                    : []
                }
              />
            ))}
          </GlassCard>
        )}
      </View>
    </View>
  );
});

type Action = { label: string; onPress: () => void; ghost?: boolean };

const Person = memo(function Person({
  entry,
  isYou,
  note,
  busy,
  actions,
}: {
  entry: RosterEntry;
  isYou: boolean;
  note?: string;
  busy: boolean;
  actions: Action[];
}) {
  return (
    <View style={styles.row}>
      <Avatar name={entry.name} uri={entry.avatarUrl} size={34} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.name}
          {isYou ? <Text style={styles.you}>  you</Text> : null}
        </Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      {actions.map((action) => (
        <Button
          key={action.label}
          label={action.label}
          variant={action.ghost ? 'ghost' : 'primary'}
          loading={busy}
          onPress={action.onPress}
          size="md"
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  group: { gap: 8 },
  card: { gap: 10, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '700', color: palette.text },
  you: { fontSize: 11, fontWeight: '700', color: palette.textFaint },
  note: { fontSize: 11, fontWeight: '700', color: accentColor.amber },
  empty: {
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: palette.glass,
    fontSize: 12.5,
    fontWeight: '600',
    color: palette.textMuted,
  },
});
