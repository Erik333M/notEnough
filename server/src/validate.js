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
    groups: normaliseGroups(body.groups),
  };
}

/**
 * Training-group state.
 *
 * Same contract as the journey slice: the client owns the shape and
 * re-validates it on read, so the server only checks the envelope is
 * well-formed and bounded. What matters is that the key is carried through at
 * all — this object is rebuilt field by field, so a slice with no passthrough
 * would be silently dropped on the first sync.
 */
function normaliseGroups(groups) {
  if (!groups || typeof groups !== 'object' || Array.isArray(groups)) return null;

  for (const field of ['groups', 'players', 'plans', 'tasks', 'assignments']) {
    const value = groups[field];
    if (value != null && !Array.isArray(value)) {
      throw new ValidationError('groups', `groups.${field} must be an array.`);
    }
    if (Array.isArray(value) && value.length > 50000) {
      throw new ValidationError('groups', `Too many entries in groups.${field}.`);
    }
  }

  return groups;
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
