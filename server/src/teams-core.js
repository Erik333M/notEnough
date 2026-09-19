import crypto from 'node:crypto';

import { makeInviteCode } from './validate.js';

/**
 * Making a team, in one place.
 *
 * Both `POST /api/teams` and `POST /api/events` need exactly this: a team row,
 * a unique invite code, and a coach membership for whoever asked. Written
 * twice it would drift — and the drift would be in who gets to administer the
 * thing they just created, which is the worst place for it.
 *
 * Must be called inside a `write`, so the uniqueness check below is made
 * against the same snapshot that is about to be persisted.
 */
export function createTeamRow(data, { name, notes, ownerId }) {
  const now = new Date().toISOString();
  const team = {
    id: crypto.randomUUID(),
    name,
    notes,
    ownerId,
    inviteCode: makeInviteCode(),
    createdAt: now,
    archived: false,
  };

  // Collision on a six-character code is unlikely but not impossible, and a
  // duplicate would silently send an athlete to the wrong squad.
  while (data.teams.some((row) => row.inviteCode === team.inviteCode)) {
    team.inviteCode = makeInviteCode();
  }

  data.teams.push(team);
  data.memberships.push({
    id: crypto.randomUUID(),
    userId: ownerId,
    teamId: team.id,
    role: 'coach',
    status: 'active',
    createdAt: now,
  });

  return team;
}
