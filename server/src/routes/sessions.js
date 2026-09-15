import crypto from 'node:crypto';
import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import { canAssignSession, canViewProgress, canViewTeam, isCoach } from '../permissions.js';
import {
  MAX_TASKS_PER_SESSION,
  ValidationError,
  requireHandoutInput,
  requireSessionInput,
  requireTaskInput,
} from '../validate.js';

/**
 * Training sessions — the thing a coach actually plans and runs.
 *
 * One concept, not two. A reusable plan is a session with `isTemplate` set,
 * which is why there is no plans table and no plans router: templates and
 * sessions have identical fields and identical screens, and splitting them
 * would make a coach learn two nouns to express one idea.
 *
 * Handing a session out creates one assignment per task per athlete, because
 * each of those needs its own result. The session id travels onto every
 * assignment, so "how did the squad do on Tuesday's session" is answerable
 * without the assignments knowing anything about each other.
 */
export const sessionsRouter = Router();

sessionsRouter.use(requireAuth);

const forbidden = (res) =>
  res.status(403).json({ error: 'forbidden', message: 'You do not have access to that session.' });

const tasksOf = (data, sessionId) =>
  data.sessionTasks.filter((row) => row.sessionId === sessionId).sort((a, b) => a.order - b.order);

/* ------------------------------------------------------------- the session */

/** Create a session, or a template. Coaches of that team only. */
sessionsRouter.post('/', async (req, res, next) => {
  try {
    const input = requireSessionInput(req.body);
    const teamId = String(req.body?.teamId ?? '');
    const userId = req.user.id;

    const created = await write((data) => {
      if (!canAssignSession(data, userId, teamId)) return null;
      const session = {
        id: crypto.randomUUID(),
        teamId,
        ...input,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        archived: false,
      };
      data.sessions.push(session);
      return session;
    });

    if (!created) return forbidden(res);
    return res.status(201).json({ session: created, tasks: [] });
  } catch (error) {
    return next(error);
  }
});

/**
 * Sessions for a team.
 *
 * `?templates=1` asks for the saved templates instead of the dated sessions.
 * Both are the same shape, so the client renders one list component twice.
 */
sessionsRouter.get('/team/:teamId', async (req, res, next) => {
  try {
    const data = await read();
    const { teamId } = req.params;
    if (!canViewTeam(data, req.user.id, teamId)) return forbidden(res);

    const wantTemplates = req.query.templates === '1';
    const sessions = data.sessions
      .filter((row) => row.teamId === teamId && !row.archived && row.isTemplate === wantTemplates)
      .map((row) => ({ ...row, taskCount: tasksOf(data, row.id).length }))
      // Newest work first for dated sessions; templates read better by name.
      .sort((a, b) =>
        wantTemplates ? a.name.localeCompare(b.name) : (b.date ?? '').localeCompare(a.date ?? ''),
      );

    return res.json({ sessions });
  } catch (error) {
    return next(error);
  }
});

/**
 * One session with its tasks, and how it is going.
 *
 * A coach gets every athlete's row; an athlete gets their own. Same endpoint,
 * same shape — the origin gate decides what is in it, so the client never has
 * to know which question it is allowed to ask.
 */
sessionsRouter.get('/:sessionId', async (req, res, next) => {
  try {
    const data = await read();
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = data.sessions.find((row) => row.id === sessionId);
    if (!session || !canViewTeam(data, userId, session.teamId)) return forbidden(res);

    const assignments = data.assignments
      .filter((row) => row.sessionId === sessionId)
      .filter((row) => canViewProgress(data, userId, row))
      .map((row) => ({
        ...row,
        result: data.results.find((entry) => entry.assignmentId === row.id) ?? null,
      }));

    return res.json({
      session,
      tasks: tasksOf(data, sessionId),
      assignments,
      role: isCoach(data, userId, session.teamId) ? 'coach' : 'athlete',
    });
  } catch (error) {
    return next(error);
  }
});

sessionsRouter.patch('/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    const archived = typeof req.body?.archived === 'boolean' ? req.body.archived : null;
    const shareResults =
      typeof req.body?.shareResults === 'boolean' ? req.body.shareResults : null;
    const input = req.body?.name === undefined ? null : requireSessionInput(req.body);

    const updated = await write((data) => {
      const session = data.sessions.find((row) => row.id === sessionId);
      if (!session || !canAssignSession(data, userId, session.teamId)) return null;
      if (input) Object.assign(session, input);
      // Flippable on its own, so opening a board is one tap and not a re-save
      // of the whole session.
      if (shareResults !== null) session.shareResults = shareResults;
      if (archived !== null) session.archived = archived;
      return session;
    });

    if (!updated) return forbidden(res);
    return res.json({ session: updated });
  } catch (error) {
    return next(error);
  }
});

/* --------------------------------------------------------------- its tasks */

sessionsRouter.post('/:sessionId/tasks', async (req, res, next) => {
  try {
    const input = requireTaskInput(req.body);
    const { sessionId } = req.params;
    const userId = req.user.id;

    const outcome = await write((data) => {
      const session = data.sessions.find((row) => row.id === sessionId);
      if (!session || !canAssignSession(data, userId, session.teamId)) return { error: 'forbidden' };

      const existing = tasksOf(data, sessionId);
      if (existing.length >= MAX_TASKS_PER_SESSION) return { error: 'too_many' };

      const task = {
        id: crypto.randomUUID(),
        sessionId,
        ...input,
        order: existing.length,
      };
      data.sessionTasks.push(task);
      return { task };
    });

    if (outcome.error === 'too_many') {
      throw new ValidationError('title', `A session can hold ${MAX_TASKS_PER_SESSION} tasks.`);
    }
    if (outcome.error) return forbidden(res);
    return res.status(201).json({ task: outcome.task });
  } catch (error) {
    return next(error);
  }
});

sessionsRouter.patch('/:sessionId/tasks/:taskId', async (req, res, next) => {
  try {
    const input = requireTaskInput(req.body);
    const { sessionId, taskId } = req.params;
    const userId = req.user.id;

    const updated = await write((data) => {
      const session = data.sessions.find((row) => row.id === sessionId);
      if (!session || !canAssignSession(data, userId, session.teamId)) return null;
      const task = data.sessionTasks.find((row) => row.id === taskId && row.sessionId === sessionId);
      if (!task) return null;
      Object.assign(task, input);
      return task;
    });

    if (!updated) return forbidden(res);
    return res.json({ task: updated });
  } catch (error) {
    return next(error);
  }
});

/**
 * Remove a task.
 *
 * Assignments already handed out for it go too: a task nobody can see any more
 * should not leave athletes holding work that no longer exists. Remaining tasks
 * are renumbered so `order` stays a dense sequence.
 */
sessionsRouter.delete('/:sessionId/tasks/:taskId', async (req, res, next) => {
  try {
    const { sessionId, taskId } = req.params;
    const userId = req.user.id;

    const outcome = await write((data) => {
      const session = data.sessions.find((row) => row.id === sessionId);
      if (!session || !canAssignSession(data, userId, session.teamId)) return { error: 'forbidden' };

      const orphaned = new Set(
        data.assignments.filter((row) => row.taskId === taskId).map((row) => row.id),
      );
      data.results = data.results.filter((row) => !orphaned.has(row.assignmentId));
      data.assignments = data.assignments.filter((row) => row.taskId !== taskId);
      data.sessionTasks = data.sessionTasks.filter((row) => row.id !== taskId);
      tasksOf(data, sessionId).forEach((row, index) => {
        row.order = index;
      });
      return { ok: true };
    });

    if (outcome.error) return forbidden(res);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});
