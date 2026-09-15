import crypto from 'node:crypto';
import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { write } from '../db.js';
import { canAssignSession, membershipOf } from '../permissions.js';
import { requireHandoutInput, requireSessionInput } from '../validate.js';

/**
 * The two verbs a coach uses on a session: hand it out, or start one from a
 * saved template.
 *
 * Mounted alongside the sessions router on the same path so the URLs stay
 * readable — this is a second file rather than a second concept, split only
 * because the first was at the size where a file stops being scannable.
 */
export const sessionActionsRouter = Router();

sessionActionsRouter.use(requireAuth);

const forbidden = (res) =>
  res.status(403).json({ error: 'forbidden', message: 'You do not have access to that session.' });

/**
 * Give a session to athletes — one assignment per task, per person.
 *
 * Re-running this is safe and useful: it creates only what is missing, so a
 * coach who adds a latecomer to the roster can hand the same session out again
 * and that one person picks it up without anyone else's work being duplicated
 * or their logged results being disturbed.
 */
sessionActionsRouter.post('/:sessionId/handout', async (req, res, next) => {
  try {
    const input = requireHandoutInput(req.body);
    const { sessionId } = req.params;
    const userId = req.user.id;
    const now = new Date().toISOString();

    const outcome = await write((data) => {
      const session = data.sessions.find((row) => row.id === sessionId);
      if (!session || !canAssignSession(data, userId, session.teamId)) return { error: 'forbidden' };
      if (session.isTemplate) return { error: 'is_template' };

      const tasks = data.sessionTasks
        .filter((row) => row.sessionId === sessionId)
        .sort((a, b) => a.order - b.order);
      if (tasks.length === 0) return { error: 'no_tasks' };

      // Named ids are checked against the roster, never trusted from the body.
      const targets = input.assigneeUserIds.filter((id) => membershipOf(data, id, session.teamId));
      if (targets.length === 0) return { error: 'no_members' };

      const dueDate = input.dueDate ?? session.date;
      const already = new Set(
        data.assignments
          .filter((row) => row.sessionId === sessionId)
          .map((row) => `${row.taskId}:${row.assigneeUserId}`),
      );

      const created = [];
      for (const assigneeUserId of targets) {
        for (const task of tasks) {
          if (already.has(`${task.id}:${assigneeUserId}`)) continue;
          created.push({
            id: crypto.randomUUID(),
            teamId: session.teamId,
            sessionId,
            taskId: task.id,
            title: task.title,
            detail: task.detail,
            kind: task.kind,
            target: task.target,
            assigneeUserId,
            dueDate,
            createdBy: userId,
            createdAt: now,
          });
        }
      }

      data.assignments.push(...created);
      return { created };
    });

    if (outcome.error === 'is_template') {
      return res.status(400).json({
        error: 'is_template',
        message: 'Start a session from this template first, then hand it out.',
      });
    }
    if (outcome.error === 'no_tasks') {
      return res
        .status(400)
        .json({ error: 'no_tasks', message: 'Add at least one task before handing this out.' });
    }
    if (outcome.error === 'no_members') {
      return res
        .status(400)
        .json({ error: 'no_members', field: 'assigneeUserIds', message: 'Nobody on this team matched.' });
    }
    if (outcome.error) return forbidden(res);

    return res.status(201).json({ assignments: outcome.created, added: outcome.created.length });
  } catch (error) {
    return next(error);
  }
});

/**
 * Start a real, dated session from a saved template.
 *
 * The tasks are copied rather than referenced, so editing the template later
 * cannot rewrite a session an athlete has already been given — and a coach can
 * tweak tonight's version without disturbing the template it came from.
 */
sessionActionsRouter.post('/:templateId/start', async (req, res, next) => {
  try {
    const input = requireSessionInput({
      name: req.body?.name ?? 'Session',
      notes: req.body?.notes,
      date: req.body?.date,
      isTemplate: false,
    });
    const { templateId } = req.params;
    const userId = req.user.id;
    const now = new Date().toISOString();

    const outcome = await write((data) => {
      const template = data.sessions.find((row) => row.id === templateId);
      if (!template || !canAssignSession(data, userId, template.teamId)) return { error: 'forbidden' };
      if (!template.isTemplate) return { error: 'not_template' };

      const session = {
        id: crypto.randomUUID(),
        teamId: template.teamId,
        name: req.body?.name ? input.name : template.name,
        notes: req.body?.notes === undefined ? template.notes : input.notes,
        isTemplate: false,
        date: input.date,
        createdBy: userId,
        createdAt: now,
        archived: false,
      };

      const tasks = data.sessionTasks
        .filter((row) => row.sessionId === templateId)
        .sort((a, b) => a.order - b.order)
        .map((row, index) => ({
          id: crypto.randomUUID(),
          sessionId: session.id,
          title: row.title,
          detail: row.detail,
          kind: row.kind,
          target: row.target,
          order: index,
        }));

      data.sessions.push(session);
      data.sessionTasks.push(...tasks);
      return { session, tasks };
    });

    if (outcome.error === 'not_template') {
      return res
        .status(400)
        .json({ error: 'not_template', message: 'That is already a session, not a template.' });
    }
    if (outcome.error) return forbidden(res);

    return res.status(201).json({ session: outcome.session, tasks: outcome.tasks });
  } catch (error) {
    return next(error);
  }
});

/**
 * Save an existing session as a reusable template.
 *
 * A copy, not a conversion: the session the squad already has keeps its
 * assignments and results exactly as they are.
 */
sessionActionsRouter.post('/:sessionId/save-as-template', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    const now = new Date().toISOString();

    const outcome = await write((data) => {
      const source = data.sessions.find((row) => row.id === sessionId);
      if (!source || !canAssignSession(data, userId, source.teamId)) return { error: 'forbidden' };

      const template = {
        id: crypto.randomUUID(),
        teamId: source.teamId,
        name: typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : source.name,
        notes: source.notes,
        isTemplate: true,
        date: null,
        createdBy: userId,
        createdAt: now,
        archived: false,
      };

      const tasks = data.sessionTasks
        .filter((row) => row.sessionId === sessionId)
        .sort((a, b) => a.order - b.order)
        .map((row, index) => ({
          id: crypto.randomUUID(),
          sessionId: template.id,
          title: row.title,
          detail: row.detail,
          kind: row.kind,
          target: row.target,
          order: index,
        }));

      data.sessions.push(template);
      data.sessionTasks.push(...tasks);
      return { template, tasks };
    });

    if (outcome.error) return forbidden(res);
    return res.status(201).json({ session: outcome.template, tasks: outcome.tasks });
  } catch (error) {
    return next(error);
  }
});
