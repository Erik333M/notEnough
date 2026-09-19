import crypto from 'node:crypto';
import { Router } from 'express';

import { requireAuth } from '../auth.js';
import { read, write } from '../db.js';
import { canManageEvent, canViewEvent } from '../permissions.js';
import { FIELD_SCOPES, MAX_FIELDS, fieldsOf } from '../stats-core.js';
import { ValidationError, requireString } from '../validate.js';

/**
 * What this event counts.
 *
 * The organiser decides. Goals, assists and yellow cards for a football camp;
 * lengths and heat places for a swimming one. Neither is something the app can
 * know in advance, so the fields are rows a person creates rather than columns
 * somebody shipped.
 *
 * A field is per team or per player. That distinction is the only structure
 * imposed, and it is the one that makes both a standings table and a top
 * scorer list possible from the same recorded numbers.
 */
export const eventFieldsRouter = Router();

eventFieldsRouter.use(requireAuth);

const forbidden = (res) =>
  res.status(403).json({ error: 'forbidden', message: 'You do not have access to that event.' });

const eventFrom = (data, eventId) => data.events.find((row) => row.id === eventId) ?? null;

/** Everyone at the event can see what is being counted. */
eventFieldsRouter.get('/:eventId/fields', async (req, res, next) => {
  try {
    const data = await read();
    const event = eventFrom(data, req.params.eventId);
    if (!canViewEvent(data, req.user.id, event)) return forbidden(res);

    return res.json({
      fields: fieldsOf(data, event.id),
      canManage: canManageEvent(data, req.user.id, event),
    });
  } catch (error) {
    return next(error);
  }
});

/** Add one. Staff only. */
eventFieldsRouter.post('/:eventId/fields', async (req, res, next) => {
  try {
    const label = requireString(req.body?.label, 'label', { min: 1, max: 30 });
    const scope = req.body?.scope ?? 'player';
    if (!FIELD_SCOPES.includes(scope)) {
      throw new ValidationError('scope', 'A field counts either a team or a player.');
    }
    const userId = req.user.id;

    const outcome = await write((data) => {
      const event = eventFrom(data, req.params.eventId);
      if (!canManageEvent(data, userId, event)) return { error: 'forbidden' };

      const existing = fieldsOf(data, event.id);
      if (existing.length >= MAX_FIELDS) return { error: 'too_many' };
      // Two fields called "Goals" would make every entry screen a guess.
      if (existing.some((row) => row.label.toLowerCase() === label.toLowerCase())) {
        return { error: 'duplicate' };
      }

      const field = {
        id: crypto.randomUUID(),
        eventId: event.id,
        label,
        scope,
        // Only the field created with the event decides results. A new one is
        // something extra to count, never a change to how games are won.
        isScore: false,
        order: existing.length,
        archived: false,
        createdAt: new Date().toISOString(),
      };
      data.statFields.push(field);
      return { field };
    });

    if (outcome.error === 'too_many') {
      throw new ValidationError('label', `An event can count ${MAX_FIELDS} things at most.`);
    }
    if (outcome.error === 'duplicate') {
      throw new ValidationError('label', 'You are already counting something by that name.');
    }
    if (outcome.error) return forbidden(res);
    return res.status(201).json({ field: outcome.field });
  } catch (error) {
    return next(error);
  }
});

/**
 * Rename one, move it, or stop counting it. Staff only.
 *
 * Removing archives rather than deletes, so numbers already recorded against
 * it are not silently rewritten — a game played last Tuesday keeps the score
 * it was given, whatever the organiser changes afterwards.
 */
eventFieldsRouter.patch('/:eventId/fields/:fieldId', async (req, res, next) => {
  try {
    const label =
      req.body?.label === undefined ? null : requireString(req.body.label, 'label', { min: 1, max: 30 });
    const archived = req.body?.archived === true;
    const order = typeof req.body?.order === 'number' ? req.body.order : null;
    const userId = req.user.id;

    const outcome = await write((data) => {
      const event = eventFrom(data, req.params.eventId);
      if (!canManageEvent(data, userId, event)) return { error: 'forbidden' };

      const field = data.statFields.find(
        (row) => row.id === req.params.fieldId && row.eventId === event.id,
      );
      if (!field) return { error: 'forbidden' };

      // The result field can be renamed but never removed: without it there is
      // nothing for the standings table to be a table of.
      if (archived && field.isScore) return { error: 'is_score' };

      if (label) {
        const clash = fieldsOf(data, event.id).some(
          (row) => row.id !== field.id && row.label.toLowerCase() === label.toLowerCase(),
        );
        if (clash) return { error: 'duplicate' };
        field.label = label;
      }
      if (order !== null) field.order = order;
      if (archived) field.archived = true;

      return { field };
    });

    if (outcome.error === 'is_score') {
      throw new ValidationError(
        'archived',
        'This is the field that decides who wins. Rename it if you like, but it has to stay.',
      );
    }
    if (outcome.error === 'duplicate') {
      throw new ValidationError('label', 'You are already counting something by that name.');
    }
    if (outcome.error) return forbidden(res);
    return res.json({ field: outcome.field });
  } catch (error) {
    return next(error);
  }
});
