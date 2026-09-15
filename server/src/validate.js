import crypto from 'node:crypto';

/**
 * Hand-rolled validation instead of a schema library: the surface is three
 * endpoints wide, and every rejection needs to name the field so the mobile
 * client can highlight the right input.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.status = 400;
  }
}

export function requireString(value, field, { min = 1, max = 200 } = {}) {
  if (typeof value !== 'string') throw new ValidationError(field, `${field} is required.`);
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new ValidationError(field, `Use at least ${min} character${min === 1 ? '' : 's'}.`);
  }
  if (trimmed.length > max) throw new ValidationError(field, `Keep it under ${max} characters.`);
  return trimmed;
}

export function requireEmail(value) {
  const email = requireString(value, 'email', { min: 3 }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new ValidationError('email', 'That email does not look right.');
  return email;
}

export function requirePassword(value) {
  if (typeof value !== 'string' || value.length < 6) {
    throw new ValidationError('password', 'Use at least 6 characters.');
  }
  if (value.length > 200) throw new ValidationError('password', 'That password is too long.');
  return value;
}

/**
 * The client owns the shape of its own state; the server only guarantees the
 * envelope is well-formed and bounded, so one bad client cannot write junk that
 * breaks every future read.
 */
export function requireStatePayload(body) {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('state', 'State payload is required.');
  }
  const { goals, log, runs, plan } = body;

  if (!Array.isArray(goals)) throw new ValidationError('goals', 'goals must be an array.');
  if (!Array.isArray(runs)) throw new ValidationError('runs', 'runs must be an array.');
  if (!log || typeof log !== 'object') throw new ValidationError('log', 'log must be an object.');
  if (!plan || typeof plan !== 'object') throw new ValidationError('plan', 'plan must be an object.');

  if (goals.length > 200) throw new ValidationError('goals', 'Too many goals.');
  if (runs.length > 500) throw new ValidationError('runs', 'Too many sessions.');

  return {
    version: Number(body.version) || 1,
    goals,
    log,
    runs: runs.slice(0, 500),
    plan,
    victories: normaliseVictories(body.victories),
    journey: normaliseJourney(body.journey),
  };
}

/**
 * Success Journey state.
 *
 * The server does not model the feature — the client owns that shape and
 * re-validates every field on read. What matters here is that the key is
 * *carried through at all*: this function is built explicitly, so a slice with
 * no passthrough would be silently dropped on the first sync and the user's
 * whole workbook would vanish on their next device.
 *
 * Optional for the same reason victories is: a client older than the feature
 * simply does not send it, and refusing those writes would lock existing
 * installs out of sync.
 */
function normaliseJourney(journey) {
  if (!journey || typeof journey !== 'object' || Array.isArray(journey)) return null;

  const { entries, checks } = journey;

  if (entries != null && (typeof entries !== 'object' || Array.isArray(entries))) {
    throw new ValidationError('journey', 'journey.entries must be an object.');
  }
  if (checks != null && (typeof checks !== 'object' || Array.isArray(checks))) {
    throw new ValidationError('journey', 'journey.checks must be an object.');
  }
  if (entries && Object.keys(entries).length > 4000) {
    throw new ValidationError('journey', 'Too much journey history.');
  }

  for (const field of ['movements', 'benchmarks', 'results', 'measurements', 'habits']) {
    const value = journey[field];
    if (value != null && !Array.isArray(value)) {
      throw new ValidationError('journey', `journey.${field} must be an array.`);
    }
    if (Array.isArray(value) && value.length > 5000) {
      throw new ValidationError('journey', `Too many entries in journey.${field}.`);
    }
  }

  return journey;
}

/**
 * 3 Victories state, kept optional on purpose: a client older than the feature
 * simply does not send it, and refusing those writes would lock existing
 * installs out of sync. Absent or malformed becomes `null`, which the client's
 * own migration turns back into a fresh default.
 */
function normaliseVictories(victories) {
  if (!victories || typeof victories !== 'object' || Array.isArray(victories)) return null;

  const { targets, log } = victories;
  if (targets != null && (typeof targets !== 'object' || Array.isArray(targets))) {
    throw new ValidationError('victories', 'victories.targets must be an object.');
  }
  if (log != null && (typeof log !== 'object' || Array.isArray(log))) {
    throw new ValidationError('victories', 'victories.log must be an object.');
  }
  if (log && Object.keys(log).length > 3650) {
    throw new ValidationError('victories', 'Too much victory history.');
  }

  return { targets: targets ?? {}, log: log ?? {} };
}

/* ------------------------------------------------------- teams and work */

/**
 * Invite codes.
 *
 * Six characters from an alphabet with no O/0 and no I/1, because these get
 * read aloud across a gym and typed by someone who is out of breath. Uppercase
 * on the way in so the athlete never has to care about their keyboard's shift
 * state.
 */
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_LENGTH = 6;

export function makeInviteCode(random = crypto.randomBytes(INVITE_LENGTH)) {
  let code = '';
  for (let i = 0; i < INVITE_LENGTH; i += 1) {
    code += INVITE_ALPHABET[random[i] % INVITE_ALPHABET.length];
  }
  return code;
}

export function requireInviteCode(value) {
  const code = requireString(value, 'code', { min: INVITE_LENGTH, max: INVITE_LENGTH }).toUpperCase();
  for (const character of code) {
    if (!INVITE_ALPHABET.includes(character)) {
      throw new ValidationError('code', 'That invite code is not valid.');
    }
  }
  return code;
}

export const TASK_KINDS = ['check', 'reps', 'minutes', 'distance'];

/** A local-time YYYY-MM-DD, kept opaque exactly as the client stores it. */
export function requireDayKey(value, field = 'dueDate') {
  const day = requireString(value, field, { min: 10, max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new ValidationError(field, 'Use a YYYY-MM-DD date.');
  }
  return day;
}

export function requireNumber(value, field, { min = 0, max = 1e6 } = {}) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) throw new ValidationError(field, `${field} must be a number.`);
  if (number < min || number > max) {
    throw new ValidationError(field, `Keep ${field} between ${min} and ${max}.`);
  }
  return number;
}

export function optionalString(value, field, max = 500) {
  if (value == null || value === '') return '';
  return requireString(value, field, { min: 0, max });
}

export function requireTeamInput(body) {
  return {
    name: requireString(body?.name, 'name', { min: 2, max: 60 }),
    notes: optionalString(body?.notes, 'notes', 500),
  };
}

/**
 * One piece of work a coach is handing out.
 *
 * `assigneeUserIds` is always a list, even for one athlete: assigning to a
 * whole squad is the common case, and a route that takes one id would grow a
 * second bulk path beside it within a week.
 */
export function requireAssignmentInput(body) {
  const ids = Array.isArray(body?.assigneeUserIds) ? body.assigneeUserIds : [];
  if (ids.length === 0) {
    throw new ValidationError('assigneeUserIds', 'Choose at least one athlete.');
  }
  if (ids.length > 200) throw new ValidationError('assigneeUserIds', 'Too many athletes at once.');
  for (const id of ids) {
    if (typeof id !== 'string' || !id) {
      throw new ValidationError('assigneeUserIds', 'Invalid athlete.');
    }
  }

  const kind = typeof body?.kind === 'string' ? body.kind : 'check';
  if (!TASK_KINDS.includes(kind)) throw new ValidationError('kind', 'Unknown task type.');

  return {
    assigneeUserIds: [...new Set(ids)],
    title: requireString(body?.title, 'title', { min: 2, max: 120 }),
    detail: optionalString(body?.detail, 'detail', 1000),
    kind,
    target: requireNumber(body?.target ?? 1, 'target', { min: 0, max: 100000 }),
    dueDate: requireDayKey(body?.dueDate),
  };
}

export function requireResultInput(body) {
  return {
    amount: requireNumber(body?.amount ?? 0, 'amount', { min: 0, max: 100000 }),
    done: Boolean(body?.done),
    notes: optionalString(body?.notes, 'notes', 1000),
  };
}

/* ---------------------------------------------------------------- sessions */

/**
 * A training session.
 *
 * There is deliberately no separate "plan" entity. A reusable plan is just a
 * session with `isTemplate` set — same fields, same tasks, same screens — so a
 * coach learns one idea ("a session") and two verbs ("save as template",
 * "start from template") rather than two overlapping concepts with their own
 * menus. A template carries no date; a real session does.
 */
export function requireSessionInput(body) {
  const isTemplate = Boolean(body?.isTemplate);
  const rawDate = body?.date;

  if (!isTemplate && (rawDate == null || rawDate === '')) {
    throw new ValidationError('date', 'Pick a date for this session.');
  }

  return {
    name: requireString(body?.name, 'name', { min: 2, max: 80 }),
    notes: optionalString(body?.notes, 'notes', 1000),
    isTemplate,
    date: isTemplate ? null : requireDayKey(rawDate, 'date'),
    /** Off unless the coach says otherwise: private is the safe default. */
    shareResults: Boolean(body?.shareResults),
  };
}

export function requireTaskInput(body) {
  const kind = typeof body?.kind === 'string' ? body.kind : 'check';
  if (!TASK_KINDS.includes(kind)) throw new ValidationError('kind', 'Unknown task type.');

  return {
    title: requireString(body?.title, 'title', { min: 2, max: 120 }),
    detail: optionalString(body?.detail, 'detail', 1000),
    kind,
    target: requireNumber(body?.target ?? 1, 'target', { min: 0, max: 100000 }),
  };
}

/** Who a session is being handed to, and when it is due. */
export function requireHandoutInput(body) {
  const ids = Array.isArray(body?.assigneeUserIds) ? body.assigneeUserIds : [];
  if (ids.length === 0) throw new ValidationError('assigneeUserIds', 'Choose at least one athlete.');
  if (ids.length > 200) throw new ValidationError('assigneeUserIds', 'Too many athletes at once.');
  for (const id of ids) {
    if (typeof id !== 'string' || !id) throw new ValidationError('assigneeUserIds', 'Invalid athlete.');
  }
  return {
    assigneeUserIds: [...new Set(ids)],
    dueDate: body?.dueDate == null ? null : requireDayKey(body.dueDate),
  };
}

/** One session cannot hold more tasks than a coach could sanely hand out. */
export const MAX_TASKS_PER_SESSION = 40;
