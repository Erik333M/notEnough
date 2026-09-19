import crypto from 'node:crypto';
import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import {
  canManageTeam,
  canViewTeam,
  eventCounts,
  eventOf,
  membershipOf,
  rosterOf,
} from '../permissions.js';
import { createTeamRow } from '../teams-core.js';
import { dayCount, requireEventInput } from '../validate.js';

/**
 * Events — a camp, a training week, a competition weekend.
 *
 * An event is a team with dates, an age group and a ceiling. That is the whole
 * design: there is no second roster, no second set of roles, and no second
 * authorization path. Staff are the team's coaches and campers are its
 * athletes, so every rule written for teams already applies here, and a bug
 * fixed in one is fixed in both.
 *
 * What the event row adds is only the things a squad does not have: when it
 * runs, who it is for, and how many fit.
 */
export const eventsRouter = Router();

eventsRouter.use(requireAuth);

const forbidden = (res) =>
  res.status(403).json({ error: 'forbidden', message: 'You do not have access to that event.' });

/** Everything a screen needs about one event, in one shape. */
const detailOf = (data, event) => {
  const team = data.teams.find((row) => row.id === event.teamId);
  return {
    event,
    team,
    counts: eventCounts(data, event.teamId),
    days: dayCount(event.startDate, event.endDate),
  };
};

/**
 * Create one. Available to every account, exactly like creating a team.
 *
 * You become its first staff member — a coach membership of this team and
 * nothing else. Running a camp is not an account type.
 */
eventsRouter.post('/', async (req, res, next) => {
  try {
    const input = requireEventInput(req.body);
    const userId = req.user.id;

    const created = await write((data) => {
      const team = createTeamRow(data, {
        name: input.name,
        notes: input.notes,
        ownerId: userId,
      });

      const event = {
        id: crypto.randomUUID(),
        teamId: team.id,
        startDate: input.startDate,
        endDate: input.endDate,
        ageMin: input.ageMin,
        ageMax: input.ageMax,
        capacity: input.capacity,
        staffTarget: input.staffTarget,
        createdAt: new Date().toISOString(),
      };
      data.events.push(event);
      return detailOf(data, event);
    });

    return res.status(201).json({ ...created, role: 'coach' });
  } catch (error) {
    return next(error);
  }
});

/**
 * The events you are part of.
 *
 * Derived from your own memberships, so there is no way to enumerate events
 * you are not in — and somebody who has never joined one gets an empty list.
 */
eventsRouter.get('/', async (req, res, next) => {
  try {
    const data = await read();
    const mine = new Map(
      data.memberships
        .filter((row) => row.userId === req.user.id && row.status === 'active')
        .map((row) => [row.teamId, row.role]),
    );

    const events = data.events
      .filter((event) => mine.has(event.teamId))
      .map((event) => ({ ...detailOf(data, event), role: mine.get(event.teamId) }))
      .filter((row) => row.team && !row.team.archived)
      .sort((a, b) => a.event.startDate.localeCompare(b.event.startDate));

    return res.json({ events });
  } catch (error) {
    return next(error);
  }
});

/** One event, with its roster. Any active member; names and roles only. */
eventsRouter.get('/:eventId', async (req, res, next) => {
  try {
    const data = await read();
    const event = data.events.find((row) => row.id === req.params.eventId);
    // Same 403 for a missing event as for somebody else's, so this cannot be
    // used to discover which event ids exist.
    if (!event || !canViewTeam(data, req.user.id, event.teamId)) return forbidden(res);

    return res.json({
      ...detailOf(data, event),
      role: membershipOf(data, req.user.id, event.teamId).role,
      roster: rosterOf(data, event.teamId, data.users),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Change the dates, the age group or the size. Staff only.
 *
 * Capacity can be lowered below the number already signed up. That is
 * deliberate: the alternative is an organiser unable to correct a typo because
 * of people who are already in. Nobody is removed by it — the camp simply
 * reads as over its own limit until they fix one or the other.
 */
eventsRouter.patch('/:eventId', async (req, res, next) => {
  try {
    const input = requireEventInput({ ...req.body, name: req.body?.name ?? 'placeholder' });
    const named = typeof req.body?.name === 'string';
    const { eventId } = req.params;
    const userId = req.user.id;

    const updated = await write((data) => {
      const event = data.events.find((row) => row.id === eventId);
      if (!event) return null;
      // Checked inside the write queue against the snapshot being mutated, so
      // a membership revoked mid-request cannot slip a change through.
      if (!canManageTeam(data, userId, event.teamId)) return null;

      Object.assign(event, {
        startDate: input.startDate,
        endDate: input.endDate,
        ageMin: input.ageMin,
        ageMax: input.ageMax,
        capacity: input.capacity,
        staffTarget: input.staffTarget,
      });

      if (named) {
        const team = data.teams.find((row) => row.id === event.teamId);
        if (team) {
          team.name = input.name;
          team.notes = input.notes;
        }
      }
      return detailOf(data, event);
    });

    if (!updated) return forbidden(res);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});
