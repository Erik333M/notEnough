import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Game } from '../../api/event-stats';
import { dayKey } from '../../lib/time';
import { accentColor, palette, radius } from '../../theme/theme';
import { Button } from '../../ui/Button';
import { Chip, SectionHeader } from '../../ui/Controls';
import { GlassCard } from '../../ui/Glass';
import { useToast } from '../../ui/Toast';
import { PressableScale } from '../../ui/Touchable';
import { GameStatsEditor } from './GameStatsEditor';
import { StandingsTable } from './StandingsTable';
import { StatFieldsCard } from './StatFieldsCard';
import { formatDay } from './eventCopy';
import { useGames } from './useGames';
import { useSquads } from './useSquads';

/**
 * Games, the table, and the schema behind both.
 *
 * Reads top-down the way the event is lived: what happened, where that leaves
 * everybody, and — for staff, at the bottom — what is being counted in the
 * first place. The schema is last because it is set once and then left alone,
 * while the fixtures are looked at every day.
 */
export const EventGamesSection = memo(function EventGamesSection({ eventId }: { eventId: string }) {
  const games = useGames(eventId);
  const squads = useSquads(eventId);
  const { notify } = useToast();
  const [entering, setEntering] = useState<string | null>(null);
  const [pairing, setPairing] = useState<string | null>(null);

  const report = async (result: { ok: boolean; message: string }) => {
    if (!result.ok && result.message) notify(result.message, 'error');
    return result.ok;
  };

  const nameOf = (teamId: string) =>
    squads.squads.find((squad) => squad.team.id === teamId)?.team.name ?? 'Disbanded';

  const scoreField = games.fields.find((row) => row.isScore);
  const scoreOf = (game: Game, teamId: string) =>
    game.stats.find((row) => row.teamId === teamId && !row.userId && row.fieldId === scoreField?.id)
      ?.value ?? 0;

  if (games.loading) return null;

  return (
    <View style={styles.wrap}>
      <SectionHeader title="Games" />

      {squads.squads.length < 2 ? (
        <Text style={styles.blurb}>
          Make at least two squads and they can play each other. Results feed a table and a
          leaderboard for everything you choose to count.
        </Text>
      ) : null}

      {games.games.map((game) => (
        <GlassCard key={game.id} style={styles.game}>
          <View style={styles.gameTop}>
            <Text style={styles.teams} numberOfLines={1}>
              {nameOf(game.homeTeamId)} v {nameOf(game.awayTeamId)}
            </Text>
            {game.status === 'played' ? (
              <Text style={styles.result}>
                {scoreOf(game, game.homeTeamId)} – {scoreOf(game, game.awayTeamId)}
              </Text>
            ) : (
              <Text style={styles.pending}>to play</Text>
            )}
          </View>
          <Text style={styles.when}>
            {formatDay(game.playedOn)}
            {game.title ? ` · ${game.title}` : ''}
          </Text>

          {entering === game.id ? (
            <GameStatsEditor
              game={game}
              fields={games.fields}
              squads={squads.squads}
              busy={games.busy === game.id}
              onCancel={() => setEntering(null)}
              onSave={async (entries) => {
                if (await report(await games.saveStats(game.id, entries))) setEntering(null);
              }}
            />
          ) : games.canManage ? (
            <View style={styles.gameActions}>
              <Button
                label={game.status === 'played' ? 'Edit the result' : 'Record the result'}
                variant="ghost"
                onPress={() => setEntering(game.id)}
                style={styles.grow}
              />
              <Button
                label="Call off"
                variant="ghost"
                loading={games.busy === game.id}
                onPress={async () => report(await games.removeGame(game.id))}
              />
            </View>
          ) : null}
        </GlassCard>
      ))}

      {/*
        Adding a fixture is two taps: the home squad, then the away one. A form
        with two dropdowns and a date would be more precise and much slower,
        and the date is almost always today.
      */}
      {games.canManage && squads.squads.length >= 2 ? (
        <GlassCard style={styles.add}>
          <Text style={styles.addTitle}>
            {pairing ? `${nameOf(pairing)} plays…` : 'New game — who is at home?'}
          </Text>
          <View style={styles.choices}>
            {squads.squads
              .filter((squad) => squad.team.id !== pairing)
              .map((squad) => (
                <Chip
                  key={squad.team.id}
                  label={squad.team.name}
                  active={false}
                  onPress={async () => {
                    if (!pairing) {
                      setPairing(squad.team.id);
                      return;
                    }
                    const home = pairing;
                    setPairing(null);
                    await report(
                      await games.addGame({
                        homeTeamId: home,
                        awayTeamId: squad.team.id,
                        playedOn: dayKey(),
                      }),
                    );
                  }}
                />
              ))}
          </View>
          {pairing ? (
            <PressableScale haptic="light" onPress={() => setPairing(null)}>
              <Text style={styles.cancel}>Start again</Text>
            </PressableScale>
          ) : null}
        </GlassCard>
      ) : null}

      {squads.squads.length > 0 ? (
        <>
          <SectionHeader title="Table" />
          <StandingsTable
            standings={games.standings}
            leaders={games.leaders}
            scoreLabel={scoreField?.label ?? 'Score'}
          />
        </>
      ) : null}

      {games.canManage ? (
        <>
          <SectionHeader title="What this event counts" />
          <StatFieldsCard
            fields={games.fields}
            busy={games.busy}
            onAdd={async (label, scope) => report(await games.addField(label, scope))}
            onRename={async (fieldId, label) => report(await games.renameField(fieldId, label))}
            onDrop={async (fieldId) => report(await games.dropField(fieldId))}
          />
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  blurb: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: palette.textMuted },
  game: { gap: 6, padding: 14 },
  gameTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teams: { flex: 1, fontSize: 14.5, fontWeight: '800', color: palette.text },
  result: { fontSize: 16, fontWeight: '800', color: accentColor.lime },
  pending: { fontSize: 11, fontWeight: '800', color: palette.textFaint, textTransform: 'uppercase' },
  when: { fontSize: 11.5, fontWeight: '600', color: palette.textMuted },
  gameActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  grow: { flex: 1 },
  add: { gap: 10, padding: 14, borderRadius: radius.md },
  addTitle: { fontSize: 13, fontWeight: '800', color: palette.text },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cancel: { fontSize: 11.5, fontWeight: '700', color: palette.textFaint, textDecorationLine: 'underline' },
});
