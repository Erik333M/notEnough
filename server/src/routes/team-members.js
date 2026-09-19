import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { write } from '../db.js';
import { canJoinTeam, canManageTeam } from '../permissions.js';
import { ValidationError } from '../validate.js';

/**
 * Who is on a roster, and in what role.
 *
 * Split from teams.js on length alone — these are team routes and share its
 * path. Both verbs here answer to the same two rules: only a coach may change
 * somebody else, and a team must never be left without one.
 */
export const teamMembersRouter = Router();

teamMembersRouter.use(requireAuth);

const forbidden = (res) =>
  res.status(403).json({ error: 'forbidden', message: 'You do not have access to that team.' });

/**
 * Promote someone to coach, put them back to athlete, or admit them from an
 * event's waiting list.
 *
 * This is how a camp gets its staff: the organiser creates the event, everyone
 * joins with the one code, and the organiser marks which of them are running
 * it. A second invite code for staff would be a second way in to guard, and
 * codes get forwarded.
 *
 * The last-coach guard is the same rule as removal, for the same reason: a
 * team with nobody able to administer it is a team nobody can ever fix.
 */
teamMembersRouter.patch('/:teamId/members/:userId', async (req, res, next) => {
  try {
    const { teamId, userId } = req.params;
    const role = req.body?.role ?? null;
    const status = req.body?.status ?? null;
    if (role !== null && role !== 'coach' && role !== 'athlete') {
      throw new ValidationError('role', 'A member is either a coach or an athlete.');
    }
    if (status !== null && status !== 'active' && status !== 'pending') {
      throw new ValidationError('status', 'A member is either active or pending.');
    }
    if (role === null && status === null) {
      throw new ValidationError('role', 'Say what to change.');
    }

    const outcome = await write((data) => {
      if (!canManageTeam(data, req.user.id, teamId)) return { error: 'forbidden' };

      const target = data.memberships.find(
        (row) => row.userId === userId && row.teamId === teamId,
      );
      if (!target) return { error: 'forbidden' };

      // Demoting or removing the only coach would leave the team with nobody
      // able to administer it.
      if (target.role === 'coach' && role === 'athlete') {
        const coaches = data.memberships.filter(
          (row) => row.teamId === teamId && row.role === 'coach' && row.status === 'active',
        );
        if (coaches.length <= 1) return { error: 'last_coach' };
      }

      if (role) target.role = role;

      /*
       * Admitting somebody has to respect the ceiling, or the waiting list
       * would be a formality. A coach is the exception, and not as a special
       * case: staff were never counted against a camper capacity, so there is
       * no place for them to take. That is also what lets a full camp bring in
       * another adult — promote them, and they are in.
       */
      if (target.role === 'coach') {
        target.status = status ?? 'active';
      } else if (status === 'active') {
        if (target.status !== 'active' && !canJoinTeam(data, teamId)) return { error: 'full' };
        target.status = 'active';
      } else if (status) {
        target.status = status;
      }

      return { ok: true, membership: target };
    });

    if (outcome.error === 'last_coach') {
      throw new ValidationError('role', 'A team needs at least one coach. Add another first.');
    }
    if (outcome.error === 'full') {
      throw new ValidationError('status', 'That event is full. Raise the limit first.');
    }
    if (outcome.error) return forbidden(res);
    return res.json({ membership: outcome.membership });
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
teamMembersRouter.delete('/:teamId/members/:userId', async (req, res, next) => {
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
