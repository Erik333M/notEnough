import crypto from 'node:crypto';
import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import { avatarUrlFor } from '../avatar-store.js';
import {
  canManageEvent,
  canViewEvent,
  childTeamsOf,
  membershipOf,
} from '../permissions.js';
import { createTeamRow } from '../teams-core.js';
import { ValidationError, requireString } from '../validate.js';

/**
 * Squads inside an event.
 *
 * Each one is an ordinary team with a parent, so nothing about rosters, roles
 * or results had to be invented for them — a camp's Red Team can be given a
 * session and log results exactly like any squad, because it *is* one.
 *
 * Two rules shape everything here:
 *
 *  1. You are in at most one squad per camp. Being on two teams at a sports
 *     day is not a thing, and allowing it would make every standings table
 *     ambiguous.
 *  2. Squads are filled by staff, never by code. The code exists on the row
 *     because every team has one; the join route refuses it.
 */
export const eventTeamsRouter = Router();

eventTeamsRouter.use(requireAuth);

const forbidden = (res) =>
  res.status(403).json({ error: 'forbidden', message: 'You do not have access to that event.' });

/** A squad and who is in it. Names and faces, exactly like any roster. */
const squadOf = (data, team) => {
  const members = data.memberships
    .filter((row) => row.teamId === team.id && row.status === 'active')
    .map((row) => {
      const user = data.users.find((candidate) => candidate.id === row.userId);
      const avatar = data.avatars.find((entry) => entry.userId === row.userId);
      return {
        userId: row.userId,
        name: user?.name ?? 'Unknown',
        role: row.role,
        avatarUrl: avatar ? avatarUrlFor(avatar.file) : null,
      };
    });
  return { team, members };
};

/** Everyone at the event can see how it is divided up. */
eventTeamsRouter.get('/:eventId/teams', async (req, res, next) => {
  try {
    const data = await read();
    const event = data.events.find((row) => row.id === req.params.eventId);
    if (!canViewEvent(data, req.user.id, event)) return forbidden(res);

    const squads = childTeamsOf(data, event.teamId).map((team) => squadOf(data, team));

    /*
     * Who is not in a squad yet.
     *
     * The single most useful thing on this screen for an organiser with forty
     * arrivals and four teams to fill, and it cannot be worked out on the
     * device without the whole camp roster and every squad's membership.
     */
    const placed = new Set(squads.flatMap(({ members }) => members.map((row) => row.userId)));
    const unassigned = data.memberships
      .filter(
        (row) =>
          row.teamId === event.teamId &&
          row.status === 'active' &&
          row.role === 'athlete' &&
          !placed.has(row.userId),
      )
      .map((row) => {
        const user = data.users.find((candidate) => candidate.id === row.userId);
        const avatar = data.avatars.find((entry) => entry.userId === row.userId);
        return {
          userId: row.userId,
          name: user?.name ?? 'Unknown',
          avatarUrl: avatar ? avatarUrlFor(avatar.file) : null,
        };
      });

    return res.json({ squads, unassigned, canManage: canManageEvent(data, req.user.id, event) });
  } catch (error) {
    return next(error);
  }
});

/** Make one. Staff only. */
eventTeamsRouter.post('/:eventId/teams', async (req, res, next) => {
  try {
    const name = requireString(req.body?.name, 'name', { min: 1, max: 40 });
    const userId = req.user.id;

    const created = await write((data) => {
      const event = data.events.find((row) => row.id === req.params.eventId);
      if (!canManageEvent(data, userId, event)) return null;
      if (childTeamsOf(data, event.teamId).length >= 40) return { error: 'too_many' };

      /*
       * The creator does not join the squad they just made.
       *
       * They are staff of the camp above it, and that is already what lets
       * them administer every squad in it. Adding them as a member would put
       * the organiser on one team out of four, and then in its results.
       */
      const team = createTeamRow(data, {
        name,
        notes: '',
        ownerId: userId,
        parentTeamId: event.teamId,
        addOwnerMembership: false,
      });
      return squadOf(data, team);
    });

    if (created?.error === 'too_many') {
      throw new ValidationError('name', 'That is as many squads as one event can hold.');
    }
    if (!created) return forbidden(res);
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
});

/** Rename or disband one. Staff only. */
eventTeamsRouter.patch('/:eventId/teams/:teamId', async (req, res, next) => {
  try {
    const name = req.body?.name === undefined ? null : requireString(req.body.name, 'name', { min: 1, max: 40 });
    const disband = req.body?.archived === true;
    const userId = req.user.id;

    const updated = await write((data) => {
      const event = data.events.find((row) => row.id === req.params.eventId);
      if (!canManageEvent(data, userId, event)) return null;
      const team = data.teams.find(
        (row) => row.id === req.params.teamId && row.parentTeamId === event.teamId,
      );
      if (!team) return null;

      if (name) team.name = name;
      if (disband) {
        // The squad's memberships go with it. Nobody leaves the camp — they
        // simply go back to being unassigned.
        team.archived = true;
        data.memberships = data.memberships.filter((row) => row.teamId !== team.id);
      }
      return squadOf(data, team);
    });

    if (!updated) return forbidden(res);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

/**
 * Put somebody in a squad. Staff only.
 *
 * Moving rather than adding: one person, one squad. If they were in another
 * one, they are taken out of it in the same write, so there is no moment at
 * which a camper is on two teams.
 */
eventTeamsRouter.put('/:eventId/teams/:teamId/members/:userId', async (req, res, next) => {
  try {
    const { eventId, teamId, userId } = req.params;
    const callerId = req.user.id;

    const outcome = await write((data) => {
      const event = data.events.find((row) => row.id === eventId);
      if (!canManageEvent(data, callerId, event)) return { error: 'forbidden' };

      const team = data.teams.find(
        (row) => row.id === teamId && row.parentTeamId === event.teamId && !row.archived,
      );
      if (!team) return { error: 'forbidden' };

      // Only somebody who is actually at the camp. Without this, a squad would
      // be a way to add a stranger to an event by id.
      const atCamp = membershipOf(data, userId, event.teamId);
      if (!atCamp) return { error: 'not_here' };

      const siblings = new Set(childTeamsOf(data, event.teamId).map((row) => row.id));
      data.memberships = data.memberships.filter(
        (row) => !(row.userId === userId && siblings.has(row.teamId)),
      );
      data.memberships.push({
        id: crypto.randomUUID(),
        userId,
        teamId: team.id,
        // Staff running the camp lead a squad; campers are in it.
        role: atCamp.role === 'coach' ? 'coach' : 'athlete',
        status: 'active',
        createdAt: new Date().toISOString(),
      });
      return { squad: squadOf(data, team) };
    });

    if (outcome.error === 'not_here') {
      throw new ValidationError('userId', 'They have not joined this event.');
    }
    if (outcome.error) return forbidden(res);
    return res.json(outcome.squad);
  } catch (error) {
    return next(error);
  }
});

/** Take somebody out of a squad, back to unassigned. Staff only. */
eventTeamsRouter.delete('/:eventId/teams/:teamId/members/:userId', async (req, res, next) => {
  try {
    const { eventId, teamId, userId } = req.params;
    const callerId = req.user.id;

    const removed = await write((data) => {
      const event = data.events.find((row) => row.id === eventId);
      if (!canManageEvent(data, callerId, event)) return null;
      const team = data.teams.find(
        (row) => row.id === teamId && row.parentTeamId === event.teamId,
      );
      if (!team) return null;

      data.memberships = data.memberships.filter(
        (row) => !(row.userId === userId && row.teamId === team.id),
      );
      return squadOf(data, team);
    });

    if (!removed) return forbidden(res);
    return res.json(removed);
  } catch (error) {
    return next(error);
  }
});
