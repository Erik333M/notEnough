import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { accentColor, palette, radius } from '../../theme/theme';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Chip, SectionHeader } from '../../ui/Controls';
import { Field } from '../../ui/Field';
import { GlassCard } from '../../ui/Glass';
import { useToast } from '../../ui/Toast';
import { PressableScale } from '../../ui/Touchable';
import { SquadCard } from './SquadCard';
import { useSquads } from './useSquads';

/**
 * Dividing a camp into squads, and filling them.
 *
 * The flow is built around the job an organiser actually has: forty people
 * have arrived and need splitting up. So the unassigned list comes first and
 * is the thing you act on — tap a person, tap the squad they go in. Two taps
 * per camper, no dragging, and the list visibly shrinks as it empties.
 */
export const EventSquadsSection = memo(function EventSquadsSection({ eventId }: { eventId: string }) {
  const squads = useSquads(eventId);
  const { notify } = useToast();
  const [placing, setPlacing] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [name, setName] = useState('');

  const report = async (result: { ok: boolean; message: string }) => {
    if (!result.ok && result.message) notify(result.message, 'error');
  };

  if (squads.loading) return null;

  return (
    <View style={styles.wrap}>
      <SectionHeader
        title="Squads"
        meta={squads.squads.length > 0 ? `${squads.squads.length} of them` : undefined}
      />

      {squads.squads.length === 0 && !making ? (
        <Text style={styles.blurb}>
          Split the camp into squads and they can be given work and play each other. A squad is a
          team like any other — it just lives inside this event.
        </Text>
      ) : null}

      {/* The pile to deal with, above the squads it is being dealt into. */}
      {squads.canManage && squads.unassigned.length > 0 ? (
        <GlassCard style={styles.pool}>
          <Text style={styles.poolTitle}>
            {squads.unassigned.length} not in a squad
          </Text>
          {squads.squads.length === 0 ? (
            <Text style={styles.blurb}>Make a squad first, then tap a name to place them.</Text>
          ) : null}

          {squads.unassigned.map((person) => (
            <View key={person.userId} style={styles.poolRow}>
              <PressableScale
                haptic="light"
                onPress={() => setPlacing(placing === person.userId ? null : person.userId)}
                accessibilityLabel={`Place ${person.name} in a squad`}
              >
                <View style={styles.person}>
                  <Avatar name={person.name} uri={person.avatarUrl} size={30} />
                  <Text style={styles.personName} numberOfLines={1}>
                    {person.name}
                  </Text>
                  <Text style={styles.hint}>
                    {placing === person.userId ? 'pick a squad' : 'place'}
                  </Text>
                </View>
              </PressableScale>

              {placing === person.userId ? (
                <View style={styles.choices}>
                  {squads.squads.map((squad) => (
                    <Chip
                      key={squad.team.id}
                      label={squad.team.name}
                      active={false}
                      onPress={async () => {
                        setPlacing(null);
                        await report(await squads.place(squad.team.id, person.userId));
                      }}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </GlassCard>
      ) : null}

      {squads.squads.map((squad) => (
        <SquadCard
          key={squad.team.id}
          squad={squad}
          canManage={squads.canManage}
          busy={squads.busy}
          onRemove={async (userId) => report(await squads.remove(squad.team.id, userId))}
          onRename={async (next) => report(await squads.rename(squad.team.id, next))}
          onDisband={async () => report(await squads.disband(squad.team.id))}
        />
      ))}

      {squads.canManage ? (
        making ? (
          <GlassCard style={styles.form}>
            <Field
              label="Name the squad"
              value={name}
              onChangeText={setName}
              placeholder="Red Team"
              icon="flag-outline"
            />
            <View style={styles.formRow}>
              <Button
                label="Create"
                loading={squads.busy === 'create'}
                disabled={name.trim().length === 0}
                onPress={async () => {
                  const result = await squads.create(name.trim());
                  if (result.ok) {
                    setName('');
                    setMaking(false);
                  } else {
                    notify(result.message, 'error');
                  }
                }}
                style={styles.grow}
              />
              <Button label="Cancel" variant="ghost" onPress={() => setMaking(false)} style={styles.grow} />
            </View>
          </GlassCard>
        ) : (
          <Button label="New squad" icon="add" variant="ghost" onPress={() => setMaking(true)} />
        )
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  blurb: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
  pool: { gap: 10, padding: 14 },
  poolTitle: { fontSize: 13, fontWeight: '800', color: accentColor.amber },
  poolRow: { gap: 8 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: palette.glass,
  },
  personName: { flex: 1, fontSize: 13.5, fontWeight: '700', color: palette.text },
  hint: { fontSize: 10.5, fontWeight: '800', color: palette.textFaint, textTransform: 'uppercase' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 8 },
  form: { gap: 10, padding: 14 },
  formRow: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
});
