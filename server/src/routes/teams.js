import crypto from 'node:crypto';
import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import {
  canJoinTeam,
  canManageTeam,
  canViewTeam,
  eventOf,
  membershipOf,
  rosterOf,
  teamsFor,
} from '../permissions.js';
import { ValidationError, makeInviteCode, requireInviteCode, requireTeamInput } from '../validate.js';
import { createTeamRow } from '../teams-core.js';

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
    const created = await write((data) =>
      createTeamRow(data, { name: input.name, notes: input.notes, ownerId: req.user.id }),
    );

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
    /*
     * Events are left out on purpose.
     *
     * A camp has a team row underneath it, so without this filter it would
     * appear twice on the same screen — once as a squad and once as an event —
     * with a different destination behind each. The event list is the one that
     * can say when it runs and how full it is, so that is the one it belongs in.
     *
     * Squads inside an event are left out for the same reason: they are shown
     * on their camp's page, where the division into teams actually means
     * something.
     */
    const mine = teamsFor(data, req.user.id)
      .filter(({ team }) => !team.archived && !team.parentTeamId && !eventOf(data, team.id))
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
      // A squad inside an event is filled by its staff, never by its code.
      // Answering "no such team" keeps a forwarded code from even confirming
      // that the squad exists.
      if (team.parentTeamId) return { error: 'no_such_team' };

      const existing = data.memberships.find(
        (row) => row.userId === userId && row.teamId === team.id,
      );
      // Re-scanning a code you already used is a no-op, not an error: it should
      // land you in the team you expected either way.
      if (existing) {
        // Re-scanning does not promote you off a waiting list you are on.
        if (existing.status !== 'pending') existing.status = 'active';
        return { team, role: existing.role, status: existing.status };
      }

      /*
       * An event has a ceiling; an ordinary squad does not.
       *
       * A full event does not turn you away — it puts you on the waiting list,
       * as `pending`, which grants nothing at all until staff admit you. That
       * is not only kinder than a dead end; it is the only way a full camp can
       * still take on another adult. Staff arrive through the same code as
       * everybody else, and promoting somebody to coach admits them, because a
       * coach never occupied a camper's place to begin with.
       *
       * Checked in here rather than before the write, so two people scanning
       * the code at the same moment cannot both take the last place.
       */
      const status = canJoinTeam(data, team.id) ? 'active' : 'pending';

      data.memberships.push({
        id: crypto.randomUUID(),
        userId,
        teamId: team.id,
        role: 'athlete',
        status,
        createdAt: new Date().toISOString(),
      });
      return { team, role: 'athlete', status, event: eventOf(data, team.id) };
    });

    if (outcome.error) {
      return res
        .status(404)
        .json({ error: 'no_such_team', field: 'code', message: 'No team uses that code.' });
    }
    return res.json({
      team: outcome.team,
      role: outcome.role,
      status: outcome.status ?? 'active',
      event: outcome.event ?? null,
    });
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
