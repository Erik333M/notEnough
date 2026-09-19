import crypto from 'node:crypto';

/**
 * The stat schema, and what it adds up to.
 *
 * An event decides for itself what is worth counting. A football camp wants
 * goals, assists and yellow cards; a swimming one wants times and heat
 * places; neither list is something this app can guess in advance, so the
 * fields are data rather than columns.
 *
 * The one thing that cannot be free-form is who won. A standings table needs
 * a result, and "which of these numbers decides it" is not derivable from a
 * list of labels the organiser typed. So exactly one team-scoped field is
 * marked `isScore`, and that one settles every game. It can be renamed —
 * "Score", "Goals", "Points" — but it cannot be deleted while games exist,
 * and there is never more than one.
 */

export const FIELD_SCOPES = ['team', 'player'];

/** Enough for a sport; small enough that the entry screen stays usable. */
export const MAX_FIELDS = 24;

export const fieldsOf = (data, eventId) =>
  data.statFields
    .filter((row) => row.eventId === eventId && !row.archived)
    .sort((a, b) => a.order - b.order);

export const scoreFieldOf = (data, eventId) =>
  fieldsOf(data, eventId).find((row) => row.isScore) ?? null;

/**
 * Every event gets a result field, whether or not anybody asks for one.
 *
 * Created with the event, and re-created if it is somehow missing, because a
 * standings table with nothing to sort by is worse than no table at all.
 */
export function ensureScoreField(data, eventId) {
  const existing = scoreFieldOf(data, eventId);
  if (existing) return existing;

  const field = {
    id: crypto.randomUUID(),
    eventId,
    label: 'Score',
    scope: 'team',
    isScore: true,
    order: 0,
    archived: false,
    createdAt: new Date().toISOString(),
  };
  data.statFields.push(field);
  return field;
}

/** Every recorded number for one game, as `${teamId}:${userId ?? ''}:${fieldId}`. */
export const statKey = (teamId, userId, fieldId) => `${teamId}:${userId ?? ''}:${fieldId}`;

/**
 * The table.
 *
 * Three points for a win and one for a draw — the arrangement almost every
 * league uses, and the one people will assume without being told. Ties in the
 * table break on difference then on scored, so two squads on nine points are
 * not left in whatever order the array happened to be in.
 *
 * Only games marked played count. A fixture somebody put in the calendar for
 * Friday must not show as a nil-nil draw on Wednesday.
 */
export function standingsOf(data, eventId, squads) {
  const score = scoreFieldOf(data, eventId);
  const played = data.games.filter((row) => row.eventId === eventId && row.status === 'played');

  const table = new Map(
    squads.map((team) => [
      team.id,
      {
        teamId: team.id,
        name: team.name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        for: 0,
        against: 0,
        difference: 0,
        points: 0,
      },
    ]),
  );

  for (const game of played) {
    const home = table.get(game.homeTeamId);
    const away = table.get(game.awayTeamId);
    // A disbanded squad leaves its games behind; they are simply not counted.
    if (!home || !away) continue;

    const valueFor = (teamId) => {
      if (!score) return 0;
      const row = data.gameStats.find(
        (entry) =>
          entry.gameId === game.id &&
          entry.teamId === teamId &&
          !entry.userId &&
          entry.fieldId === score.id,
      );
      return row?.value ?? 0;
    };

    const hs = valueFor(game.homeTeamId);
    const as = valueFor(game.awayTeamId);

    home.played += 1;
    away.played += 1;
    home.for += hs;
    home.against += as;
    away.for += as;
    away.against += hs;

    if (hs > as) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (as > hs) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  return [...table.values()]
    .map((row) => ({ ...row, difference: row.for - row.against }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.difference - a.difference ||
        b.for - a.for ||
        a.name.localeCompare(b.name),
    );
}

/**
 * Who leads each player-scoped field.
 *
 * Summed across every played game. This is the half of the feature people
 * actually talk about — top scorer, most assists — and it falls out of the
 * same rows the standings use, so there is nothing separate to keep in step.
 */
export function leadersOf(data, eventId, nameOf, limit = 5) {
  const playerFields = fieldsOf(data, eventId).filter((row) => row.scope === 'player');
  const played = new Set(
    data.games.filter((row) => row.eventId === eventId && row.status === 'played').map((row) => row.id),
  );

  return playerFields.map((field) => {
    const totals = new Map();
    for (const row of data.gameStats) {
      if (row.fieldId !== field.id || !row.userId || !played.has(row.gameId)) continue;
      totals.set(row.userId, (totals.get(row.userId) ?? 0) + row.value);
    }

    const rows = [...totals.entries()]
      .filter(([, value]) => value !== 0)
      .map(([userId, value]) => ({ userId, name: nameOf(userId), value }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
      .slice(0, limit);

    return { field, rows };
  });
}
