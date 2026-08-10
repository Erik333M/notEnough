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
  };
}
