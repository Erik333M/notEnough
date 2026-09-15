import crypto from 'node:crypto';
import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import { canManageTeam, canViewTeam, membershipOf, rosterOf, teamsFor } from '../permissions.js';
import { ValidationError, makeInviteCode, requireInviteCode, requireTeamInput } from '../validate.js';

export const teamsRouter = Router();

teamsRouter.use(requireAuth);

const forbidden = (res) =>
  res.status(403).json({ error: 'forbidden', message: 'You do not have access to that team.' });

/**
 * Create a team. Available to every account, with no separate signup.
 *
 * This is the only way to become a coach, and it is a per-team fact rather than
 * a property of the account: the creator gets a coach membership *of this
 * team*, and stays an ordinary athlete everywhere else. Nothing about their
 * user row changes, so there is no role to migrate and no second account type.
 */
teamsRouter.post('/', async (req, res, next) => {
  try {
    const input = requireTeamInput(req.body);
    const now = new Date().toISOString();
    const team = {
      id: crypto.randomUUID(),
      name: input.name,
      notes: input.notes,
      ownerId: req.user.id,
      inviteCode: makeInviteCode(),
      createdAt: now,
      archived: false,
    };

    const created = await write((data) => {
      // Collision on a six-character code is unlikely but not impossible, and
      // a duplicate would silently send an athlete to the wrong squad.
      while (data.teams.some((row) => row.inviteCode === team.inviteCode)) {
        team.inviteCode = makeInviteCode();
      }
      data.teams.push(team);
      data.memberships.push({
        id: crypto.randomUUID(),
        userId: req.user.id,
        teamId: team.id,
        role: 'coach',
        status: 'active',
        createdAt: now,
      });
      return team;
    });

    return res.status(201).json({ team: created, role: 'coach' });
  } catch (error) {
    return next(error);
  }
});

/**
 * Teams the caller belongs to, with the role they hold in each.
 *
 * Derived from their own memberships, so there is no way to enumerate teams
 * they are not in — and a solo user simply gets an empty list, which is what
 * makes the whole feature invisible until someone opts into it.
 */
teamsRouter.get('/', async (req, res, next) => {
  try {
    const data = await read();
    const mine = teamsFor(data, req.user.id)
      .filter(({ team }) => !team.archived)
      .map(({ team, membership }) => ({ team, role: membership.role }));
    return res.json({ teams: mine });
  } catch (error) {
    return next(error);
  }
});

/** Join with a code. Coaches never create athlete accounts; athletes come to them. */
teamsRouter.post('/join', async (req, res, next) => {
  try {
    const code = requireInviteCode(req.body?.code);
    const userId = req.user.id;

    const outcome = await write((data) => {
      const team = data.teams.find((row) => row.inviteCode === code && !row.archived);
      if (!team) return { error: 'no_such_team' };

      const existing = data.memberships.find(
        (row) => row.userId === userId && row.teamId === team.id,
      );
      // Re-scanning a code you already used is a no-op, not an error: it should
      // land you in the team you expected either way.
      if (existing) {
        existing.status = 'active';
        return { team, role: existing.role };
      }

      data.memberships.push({
        id: crypto.randomUUID(),
        userId,
        teamId: team.id,
        role: 'athlete',
        status: 'active',
        createdAt: new Date().toISOString(),
      });
      return { team, role: 'athlete' };
    });

    if (outcome.error) {
      return res
        .status(404)
        .json({ error: 'no_such_team', field: 'code', message: 'No team uses that code.' });
    }
    return res.json({ team: outcome.team, role: outcome.role });
  } catch (error) {
    return next(error);
  }
});

/** The team and its roster. Any active member; names and roles only. */
teamsRouter.get('/:teamId', async (req, res, next) => {
  try {
    const data = await read();
    const { teamId } = req.params;
    // Same 403 whether the team is missing or merely none of your business, so
    // the endpoint cannot be used to discover which team ids exist.
    if (!canViewTeam(data, req.user.id, teamId)) return forbidden(res);

    const team = data.teams.find((row) => row.id === teamId);
    if (!team) return forbidden(res);

    return res.json({
      team,
      role: membershipOf(data, req.user.id, teamId).role,
      roster: rosterOf(data, teamId, data.users),
    });
  } catch (error) {
    return next(error);
  }
});

/** Rename, re-note, archive, or rotate the invite code. Coaches only. */
teamsRouter.patch('/:teamId', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;
    const input = req.body?.name === undefined ? null : requireTeamInput(req.body);
    const rotate = Boolean(req.body?.rotateInviteCode);
    const archived = typeof req.body?.archived === 'boolean' ? req.body.archived : null;

    const updated = await write((data) => {
      // Checked inside the write queue against the same snapshot being mutated,
      // so a membership revoked mid-request cannot slip a change through.
      if (!canManageTeam(data, userId, teamId)) return null;
      const team = data.teams.find((row) => row.id === teamId);
      if (!team) return null;

      if (input) {
        team.name = input.name;
        team.notes = input.notes;
      }
      if (archived !== null) team.archived = archived;
      if (rotate) {
        do {
          team.inviteCode = makeInviteCode();
        } while (data.teams.filter((row) => row.inviteCode === team.inviteCode).length > 1);
      }
      return team;
    });

    if (!updated) return forbidden(res);
    return res.json({ team: updated });
  } catch (error) {
    return next(error);
  }
});

/**
 * Leave a team, or — as a coach — remove someone from it.
 *
 * The membership goes; nothing the person recorded does. Their results stay
 * theirs, and the coach simply stops being able to reach them, because access
 * was never stored on the result in the first place: it was derived from a
 * membership that no longer exists.
 */
teamsRouter.delete('/:teamId/members/:userId', async (req, res, next) => {
  try {
    const { teamId, userId } = req.params;
    const callerId = req.user.id;

    const outcome = await write((data) => {
      const self = userId === callerId;
      if (!self && !canManageTeam(data, callerId, teamId)) return { error: 'forbidden' };

      const target = data.memberships.find(
        (row) => row.userId === userId && row.teamId === teamId,
      );
      if (!target) return { error: 'forbidden' };

      // A team with no coach can never be administered again, and the rows
      // would outlive anyone able to delete them.
      const coaches = data.memberships.filter(
        (row) => row.teamId === teamId && row.role === 'coach' && row.status === 'active',
      );
      if (target.role === 'coach' && coaches.length <= 1) return { error: 'last_coach' };

      data.memberships = data.memberships.filter((row) => row.id !== target.id);
      return { ok: true };
    });

    if (outcome.error === 'last_coach') {
      throw new ValidationError('userId', 'A team needs at least one coach. Add another first.');
    }
    if (outcome.error) return forbidden(res);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});
