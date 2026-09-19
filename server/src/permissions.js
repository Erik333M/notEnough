/**
 * The only place in the server that decides who may see or change what.
 *
 * Every route asks this module. Nothing does its own comparison of ids, because
 * an authorization rule that exists in two places is a rule that will disagree
 * with itself the first time one copy is edited.
 *
 * ── The rule this feature is built on ───────────────────────────────────────
 *
 * Visibility is scoped by ORIGIN, not by ownership.
 *
 * A coach can see a result because of where the work came from — an assignment
 * they gave inside their own team — and for no other reason. Being someone's
 * coach grants no access to anything that user did on their own: their journey,
 * personal goals, measurements and intake stay in their private state blob,
 * which this server never reads into and no endpoint here can reach.
 *
 * That is enforced structurally rather than by discipline. Note the signature
 * of `canViewProgress`: it takes an *assignment*, never a user id. There is
 * deliberately no function anywhere that answers "show me everything user X
 * has done", so no route can be written that asks it.
 *
 * These are pure predicates over a database snapshot — no I/O, so a route can
 * call them inside the write queue against the same `data` it is about to
 * mutate, and a check can never go stale between testing and writing.
 */

import { avatarUrlFor } from './avatar-store.js';

/* ------------------------------------------------------------- membership */

/**
 * The caller's active membership of a team, or null.
 *
 * `pending` never counts. An invite that has been issued but not accepted, or a
 * membership a coach has suspended, must not grant a single byte of access.
 */
export function membershipOf(data, userId, teamId) {
  if (!userId || !teamId) return null;
  return (
    data.memberships.find(
      (row) => row.userId === userId && row.teamId === teamId && row.status === 'active',
    ) ?? null
  );
}

export function isCoach(data, userId, teamId) {
  return membershipOf(data, userId, teamId)?.role === 'coach';
}

export function isMember(data, userId, teamId) {
  return membershipOf(data, userId, teamId) !== null;
}

/** Teams the user actually belongs to. The only way to enumerate teams. */
export function teamsFor(data, userId) {
  const mine = data.memberships.filter((row) => row.userId === userId && row.status === 'active');
  return mine
    .map((row) => {
      const team = data.teams.find((candidate) => candidate.id === row.teamId);
      return team ? { team, membership: row } : null;
    })
    .filter(Boolean);
}

/* ------------------------------------------------------- the four gates */

/** Rename, archive, remove members, rotate the invite code. Coaches only. */
export function canManageTeam(data, userId, teamId) {
  return isCoach(data, userId, teamId);
}

/**
 * See the team exists, its name, and its roster.
 *
 * Any active member, because an athlete has to know which team they are in and
 * who is coaching them. The roster deliberately carries names and roles only —
 * see `rosterOf` for why an email never appears in it.
 */
export function canViewTeam(data, userId, teamId) {
  return isMember(data, userId, teamId);
}

/** Give out work. Coaches of that team, and no one else. */
export function canAssignSession(data, userId, teamId) {
  return isCoach(data, userId, teamId);
}

/**
 * Read the progress recorded against one assignment.
 *
 * Takes the assignment, never a user id — that is the whole safeguard. Access
 * is derived from the work's origin: you may read it if you were the one asked
 * to do it, or if you coach the team it was set in. A coach of a different team
 * fails both tests even when the same athlete is on both rosters, because the
 * question being asked is about this piece of work, not about that person.
 */
export function canViewProgress(data, userId, assignment) {
  if (!assignment) return false;
  if (assignment.assigneeUserId === userId) return true;
  if (isCoach(data, userId, assignment.teamId)) return true;

  // A session board the coach has opened to the squad. Off by default and set
  // per session, because "everyone can see Tuesday's conditioning" and "1RM
  // testing stays private" are both reasonable and only the coach knows which
  // is which. Teammates get in only while that switch is on, and only for the
  // session it was set on.
  if (!assignment.sessionId) return false;
  const session = data.sessions.find((row) => row.id === assignment.sessionId);
  if (!session?.shareResults) return false;
  return isMember(data, userId, assignment.teamId);
}

/**
 * Record progress against an assignment.
 *
 * The assignee alone. A coach sets the work and reads the outcome; they do not
 * get to log an athlete's result for them, because a record of what someone
 * did should have been written by the person who did it.
 */
export function canLogResult(data, userId, assignment) {
  return Boolean(assignment) && assignment.assigneeUserId === userId;
}

/**
 * Take a shared achievement down.
 *
 * The person who posted it, or a coach of that team. A coach needs it to keep
 * a feed clean; nobody else gets to delete somebody's post.
 */
export function canRemoveShare(data, userId, share) {
  if (!share) return false;
  if (share.userId === userId) return true;
  return isCoach(data, userId, share.teamId);
}

/**
 * Take part in a challenge, and appear on its ranking.
 *
 * Any active member of the team it belongs to. Joining is an act, never a
 * default: a member who has not joined has no entry and no place on the board,
 * which is what keeps a leaderboard something you opted into rather than
 * something that happened to you.
 */
export function canEnterChallenge(data, userId, challenge) {
  return Boolean(challenge) && !challenge.archived && isMember(data, userId, challenge.teamId);
}

/** Create, edit or close a challenge. Coaches of that team. */
export function canManageChallenge(data, userId, challenge) {
  return Boolean(challenge) && isCoach(data, userId, challenge.teamId);
}

/* ----------------------------------------------------------------- friends */

/**
 * Whether two people are actually friends.
 *
 * Accepted only. A request that has been sent and not answered grants nothing
 * — otherwise sending one would be enough to start reading somebody, and
 * "request" would be a formality rather than a question.
 */
export function areFriends(data, a, b) {
  if (!a || !b || a === b) return false;
  return data.friendships.some(
    (row) =>
      row.status === 'accepted' &&
      ((row.requesterId === a && row.addresseeId === b) ||
        (row.requesterId === b && row.addresseeId === a)),
  );
}

/**
 * Read someone's public profile — their name, streak and level.
 *
 * Yourself, or an accepted friend. Note what this still does not permit: the
 * profile holds figures the owner's device chose to publish, never a way into
 * their training. A friend sees that you are on a 30 day streak, not what any
 * of those days contained.
 */
export function canViewProfile(data, viewerId, ownerId) {
  return viewerId === ownerId || areFriends(data, viewerId, ownerId);
}

/* ------------------------------------------------------------------ events */

/**
 * The event rows attached to a team, or null for an ordinary squad.
 *
 * Every rule below asks this first, so a plain team keeps behaving exactly as
 * it did before events existed — no ceiling, no dates, nothing to migrate.
 */
export function eventOf(data, teamId) {
  return data.events.find((row) => row.teamId === teamId) ?? null;
}

/**
 * Who is actually there.
 *
 * Staff are counted apart from campers and do not consume a place. A camp
 * "for 40" means forty children; the four adults running it were never what
 * the number was about.
 */
export function eventCounts(data, teamId) {
  const active = data.memberships.filter(
    (row) => row.teamId === teamId && row.status === 'active',
  );
  return {
    campers: active.filter((row) => row.role === 'athlete').length,
    staff: active.filter((row) => row.role === 'coach').length,
  };
}

/**
 * Whether one more person will fit.
 *
 * An ordinary team has no ceiling and never has had, so this answers yes for
 * everything that is not an event.
 */
export function canJoinTeam(data, teamId) {
  const event = eventOf(data, teamId);
  if (!event) return true;
  return eventCounts(data, teamId).campers < event.capacity;
}

/**
 * Squads inside an event.
 *
 * A child team is a team, with the same memberships and the same rules. What
 * makes it a child is that it is reached through its event: it never appears
 * in somebody's list of teams, and its code will not let anybody in.
 */
export function childTeamsOf(data, parentTeamId) {
  return data.teams.filter((row) => row.parentTeamId === parentTeamId && !row.archived);
}

/**
 * Who may set up and fill the squads inside an event.
 *
 * The event's staff, which is to say the coaches of the event's own team.
 * Deliberately not "the coach of the child team": a camp's organiser must be
 * able to fix any squad in it, including one they did not create.
 */
export function canManageEventTeams(data, userId, event) {
  return Boolean(event) && canManageTeam(data, userId, event.teamId);
}

/** Everyone at the event may see how it is divided up. */
export function canViewEvent(data, userId, event) {
  return Boolean(event) && canViewTeam(data, userId, event.teamId);
}

/* ------------------------------------------------------------- projections */

/**
 * The roster as it leaves the server.
 *
 * Names and roles, never email addresses. A team invite is not consent to hand
 * your address to everyone else who scanned the same code, and a coach does not
 * need one to run a session — they invited these people, so they know who they
 * are. Keeping it out means a leaked roster response leaks nothing reusable.
 */
export function rosterOf(data, teamId, users) {
  return data.memberships
    .filter((row) => row.teamId === teamId)
    .map((row) => {
      const user = users.find((candidate) => candidate.id === row.userId);
      const avatar = data.avatars.find((entry) => entry.userId === row.userId);
      return {
        userId: row.userId,
        name: user?.name ?? 'Unknown',
        // Travels with the name, on the same reasoning: a squad list you are
        // already allowed to read is allowed to have faces on it.
        avatarUrl: avatar ? avatarUrlFor(avatar.file) : null,
        role: row.role,
        status: row.status,
        joinedAt: row.createdAt,
      };
    });
}
