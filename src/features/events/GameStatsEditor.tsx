import { memo, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Game, StatEntry, StatField } from '../../api/event-stats';
import type { Squad } from '../../api/events';
import { accentColor, palette, radius } from '../../theme/theme';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { GlassCard } from '../../ui/Glass';
import { StatInput } from './StatInput';

/**
 * Entering a result.
 *
 * Built entirely from the fields the organiser defined, so this component
 * knows nothing about goals, cards or possession — only that some numbers
 * belong to a squad and some to a person in it.
 *
 * Everything is edited locally and saved in one press. Somebody doing this is
 * reading off a team sheet, and a screen that saved on every keystroke would
 * put nine half-finished versions of the game into the table on the way.
 */
export const GameStatsEditor = memo(function GameStatsEditor({
  game,
  fields,
  squads,
  busy,
  onSave,
  onCancel,
}: {
  game: Game;
  fields: StatField[];
  squads: Squad[];
  busy: boolean;
  onSave: (entries: StatEntry[]) => void;
  onCancel: () => void;
}) {
  const teamFields = fields.filter((row) => row.scope === 'team');
  const playerFields = fields.filter((row) => row.scope === 'player');
  const sides = [game.homeTeamId, game.awayTeamId]
    .map((id) => squads.find((squad) => squad.team.id === id))
    .filter((squad): squad is Squad => Boolean(squad));

  /** Existing numbers, keyed so a lookup is not a scan of the whole array. */
  const [values, setValues] = useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {};
    for (const row of game.stats) seed[`${row.teamId}:${row.userId ?? ''}:${row.fieldId}`] = row.value;
    return seed;
  });

  const set = (key: string, value: number) => setValues((prev) => ({ ...prev, [key]: value }));
  const get = (key: string) => values[key] ?? 0;

  const entries = useMemo(
    () =>
      Object.entries(values)
        // A zero is the absence of a figure, not a figure. Sending them all
        // would fill the database with rows meaning "nothing happened".
        .filter(([, value]) => value !== 0)
        .map(([key, value]) => {
          const [teamId, userId, fieldId] = key.split(':');
          return { teamId, userId: userId || null, fieldId, value };
        }),
    [values],
  );

  return (
    <GlassCard style={styles.card}>
      {sides.length < 2 ? (
        <Text style={styles.warn}>One of these squads has been disbanded.</Text>
      ) : null}

      {sides.map((side) => (
        <View key={side.team.id} style={styles.side}>
          <Text style={styles.sideName}>{side.team.name}</Text>

          {teamFields.map((field) => (
            <StatInput
              key={field.id}
              label={field.label}
              value={get(`${side.team.id}::${field.id}`)}
              onChange={(next) => set(`${side.team.id}::${field.id}`, next)}
              min={-100000}
            />
          ))}

          {playerFields.length === 0 ? null : side.members.length === 0 ? (
            <Text style={styles.quiet}>Nobody is in this squad yet.</Text>
          ) : (
            side.members.map((member) => (
              <View key={member.userId} style={styles.person}>
                <View style={styles.personHead}>
                  <Avatar name={member.name} uri={member.avatarUrl} size={26} />
                  <Text style={styles.personName} numberOfLines={1}>
                    {member.name}
                  </Text>
                </View>
                {playerFields.map((field) => (
                  <StatInput
                    key={field.id}
                    label={field.label}
                    value={get(`${side.team.id}:${member.userId}:${field.id}`)}
                    onChange={(next) => set(`${side.team.id}:${member.userId}:${field.id}`, next)}
                  />
                ))}
              </View>
            ))
          )}
        </View>
      ))}

      <View style={styles.actions}>
        <Button
          label="Save the result"
          icon="checkmark"
          loading={busy}
          onPress={() => onSave(entries)}
          style={styles.grow}
        />
        <Button label="Cancel" variant="ghost" onPress={onCancel} style={styles.grow} />
      </View>
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: { gap: 14, padding: 14 },
  side: { gap: 8 },
  sideName: { fontSize: 14, fontWeight: '800', color: accentColor.cyan },
  person: { gap: 6, padding: 10, borderRadius: radius.md, backgroundColor: palette.glass },
  personHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personName: { flex: 1, fontSize: 13, fontWeight: '700', color: palette.text },
  quiet: { fontSize: 11.5, fontWeight: '600', color: palette.textFaint },
  warn: { fontSize: 12, fontWeight: '700', color: accentColor.amber },
  actions: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
});
