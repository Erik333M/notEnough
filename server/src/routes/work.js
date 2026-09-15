import crypto from 'node:crypto';
import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import {
  canAssignSession,
  canLogResult,
  canViewProgress,
  canViewTeam,
  isCoach,
  membershipOf,
} from '../permissions.js';
import { requireAssignmentInput, requireResultInput } from '../validate.js';

/**
 * Assigned work and the results recorded against it — the shared half of the
 * app, and the only data one user can ever see belonging to another.
 *
 * Every read here is keyed by a team or an assignment. None of them takes a
 * user id and returns that user's progress, and that absence is the feature's
 * central privacy guarantee: an athlete's own training is not merely hidden
 * behind a check, it has no route out of the server at all.
 */
export const workRouter = Router();

workRouter.use(requireAuth);

const forbidden = (res) =>
  res.status(403).json({ error: 'forbidden', message: 'You do not have access to that work.' });

/** Attaches each assignment's result, or null when nothing has been logged. */
function withResult(data, assignment) {
  return {
    ...assignment,
    result: data.results.find((row) => row.assignmentId === assignment.id) ?? null,
  };
}

/**
 * Hand out work — to one athlete or the whole squad in a single call.
 *
 * One assignment row per athlete rather than one shared row with a list of
 * people on it, so each athlete's due date, result and notes stay independent
 * and a coach can adjust one person's without touching anyone else's.
 */
workRouter.post('/assignments', async (req, res, next) => {
  try {
    const input = requireAssignmentInput(req.body);
    const teamId = String(req.body?.teamId ?? '');
    const userId = req.user.id;
    const now = new Date().toISOString();

    const outcome = await write((data) => {
      if (!canAssignSession(data, userId, teamId)) return { error: 'forbidden' };

      // Every assignee must actually be on this roster. Without this a coach
      // could name any user id in the request body and start writing rows into
      // a stranger's assignment list.
      const targets = input.assigneeUserIds.filter((id) => membershipOf(data, id, teamId));
      if (targets.length === 0) return { error: 'no_members' };

      const created = targets.map((assigneeUserId) => ({
        id: crypto.randomUUID(),
        teamId,
        /** Null means standalone work, typed straight into the roster. */
        sessionId: null,
        taskId: null,
        title: input.title,
        detail: input.detail,
        kind: input.kind,
        target: input.target,
        assigneeUserId,
        dueDate: input.dueDate,
        createdBy: userId,
        createdAt: now,
      }));

      data.assignments.push(...created);
      return { created };
    });

    if (outcome.error === 'no_members') {
      return res
        .status(400)
        .json({ error: 'no_members', field: 'assigneeUserIds', message: 'Nobody on this team matched.' });
    }
    if (outcome.error) return forbidden(res);
    return res.status(201).json({ assignments: outcome.created });
  } catch (error) {
    return next(error);
  }
});

/**
 * The caller's own assigned work, across every team they are in.
 *
 * Scoped to `req.user.id` from the verified token — never to a parameter — so
 * there is no id for a caller to substitute.
 */
workRouter.get('/mine', async (req, res, next) => {
  try {
    const data = await read();
    const mine = data.assignments
      .filter((row) => row.assigneeUserId === req.user.id)
      .map((row) => withResult(data, row))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return res.json({ assignments: mine });
  } catch (error) {
    return next(error);
  }
});

/**
 * Work inside one team.
 *
 * A coach sees the whole team's assignments and their results — but only these,
 * the work that originated from this team. An athlete asking the same question
 * gets their own rows and nobody else's, so the endpoint is safe to call from
 * either side of the roster without the client deciding what to request.
 */
workRouter.get('/teams/:teamId', async (req, res, next) => {
  try {
    const data = await read();
    const { teamId } = req.params;
    const userId = req.user.id;
    if (!canViewTeam(data, userId, teamId)) return forbidden(res);

    const coach = isCoach(data, userId, teamId);
    const rows = data.assignments
      .filter((row) => row.teamId === teamId)
      // The gate alone decides who sees what. It knows about coaches, about
      // your own work, and about sessions the coach has opened to the squad,
      // so no route needs its own idea of the rule.
      .filter((row) => canViewProgress(data, userId, row))
      .map((row) => withResult(data, row))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return res.json({ assignments: rows, role: coach ? 'coach' : 'athlete' });
  } catch (error) {
    return next(error);
  }
});

/**
 * Record progress. The assignee only.
 *
 * `done` is stored rather than recomputed from `amount >= target`, because a
 * session cut short by an injury is still a session the athlete completed as
 * far as they were able, and that judgement should survive.
 */
workRouter.put('/assignments/:assignmentId/result', async (req, res, next) => {
  try {
    const input = requireResultInput(req.body);
    const { assignmentId } = req.params;
    const userId = req.user.id;
    const now = new Date().toISOString();

    const outcome = await write((data) => {
      const assignment = data.assignments.find((row) => row.id === assignmentId);
      if (!canLogResult(data, userId, assignment)) return { error: 'forbidden' };

      const existing = data.results.find((row) => row.assignmentId === assignmentId);
      if (existing) {
        Object.assign(existing, input, { updatedAt: now });
        return { result: existing };
      }

      const result = {
        id: crypto.randomUUID(),
        assignmentId,
        userId,
        ...input,
        createdAt: now,
        updatedAt: now,
      };
      data.results.push(result);
      return { result };
    });

    if (outcome.error) return forbidden(res);
    return res.json({ result: outcome.result });
  } catch (error) {
    return next(error);
  }
});

/** Withdraw an assignment. Coaches of its team only; the result goes with it. */
workRouter.delete('/assignments/:assignmentId', async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;

    const outcome = await write((data) => {
      const assignment = data.assignments.find((row) => row.id === assignmentId);
      if (!assignment || !canAssignSession(data, userId, assignment.teamId)) {
        return { error: 'forbidden' };
      }
      data.assignments = data.assignments.filter((row) => row.id !== assignmentId);
      data.results = data.results.filter((row) => row.assignmentId !== assignmentId);
      return { ok: true };
    });

    if (outcome.error) return forbidden(res);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});
