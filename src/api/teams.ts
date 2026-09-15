import { request, type ApiResult } from './client';

/**
 * Teams, sessions and assigned work.
 *
 * Separate from `client.ts` because this is the shared half of the app: every
 * call here touches data that more than one person can see, and keeping it in
 * its own file makes that boundary visible at the import line.
 *
 * None of these fetch anyone's private training. There is no endpoint that
 * takes a user id and returns their progress — a coach reads results through
 * the session or team the work came from, and nothing else is reachable.
 */

export type TeamRole = 'coach' | 'athlete';
export type MembershipStatus = 'pending' | 'active';

/** How a task is measured. Same four kinds the rest of the app counts in. */
export type TaskKind = 'check' | 'reps' | 'minutes' | 'distance';

/** A local-time `YYYY-MM-DD`, kept opaque exactly as the app stores it. */
export type DayKey = string;

export type Team = {
  id: string;
  name: string;
  notes: string;
  ownerId: string;
  /** Six unambiguous characters — no O/0 or I/1, because these get read aloud. */
  inviteCode: string;
  createdAt: string;
  archived: boolean;
};

export type RosterEntry = {
  userId: string;
  /** Names only. The server never puts an email in a roster. */
  name: string;
  role: TeamRole;
  status: MembershipStatus;
  joinedAt: string;
};

/**
 * A training session — and, with `isTemplate`, a reusable one.
 *
 * Deliberately one type rather than a session type and a plan type. A template
 * is a session with no date, so the same list and the same editor serve both.
 */
export type Session = {
  id: string;
  teamId: string;
  name: string;
  notes: string;
  isTemplate: boolean;
  date: DayKey | null;
  createdBy: string;
  createdAt: string;
  archived: boolean;
  /** Present on list responses only. */
  taskCount?: number;
};

export type SessionTask = {
  id: string;
  sessionId: string;
  title: string;
  detail: string;
  kind: TaskKind;
  target: number;
  order: number;
};

export type Result = {
  id: string;
  assignmentId: string;
  userId: string;
  amount: number;
  /** Stored, not derived: a coach can call short work complete. */
  done: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

/** One task, given to one athlete, for one date. */
export type Assignment = {
  id: string;
  teamId: string;
  sessionId: string | null;
  taskId: string | null;
  title: string;
  detail: string;
  kind: TaskKind;
  target: number;
  assigneeUserId: string;
  dueDate: DayKey;
  createdBy: string;
  createdAt: string;
  result: Result | null;
};

type TeamsList = { teams: { team: Team; role: TeamRole }[] };
type TeamDetail = { team: Team; role: TeamRole; roster: RosterEntry[] };
type SessionDetail = {
  session: Session;
  tasks: SessionTask[];
  assignments: Assignment[];
  role: TeamRole;
};

export const teamsApi = {
  /* ------------------------------------------------------------- teams */

  /** Available to every account. Creating a team is the only way to coach one. */
  create: (token: string, name: string, notes = ''): Promise<ApiResult<{ team: Team; role: TeamRole }>> =>
    request('/api/teams', { method: 'POST', token, body: { name, notes } }),

  /** Empty for a solo user, which is what keeps the feature out of their way. */
  mine: (token: string): Promise<ApiResult<TeamsList>> => request('/api/teams', { token }),

  detail: (token: string, teamId: string): Promise<ApiResult<TeamDetail>> =>
    request(`/api/teams/${teamId}`, { token }),

  join: (token: string, code: string): Promise<ApiResult<{ team: Team; role: TeamRole }>> =>
    request('/api/teams/join', { method: 'POST', token, body: { code } }),

  update: (
    token: string,
    teamId: string,
    body: { name?: string; notes?: string; archived?: boolean; rotateInviteCode?: boolean },
  ): Promise<ApiResult<{ team: Team }>> =>
    request(`/api/teams/${teamId}`, { method: 'PATCH', token, body }),

  /** Leaving, or being removed. Nothing the person recorded goes with it. */
  removeMember: (token: string, teamId: string, userId: string): Promise<ApiResult<null>> =>
    request(`/api/teams/${teamId}/members/${userId}`, { method: 'DELETE', token }),

  /* ---------------------------------------------------------- sessions */

  sessions: (token: string, teamId: string, templates = false): Promise<ApiResult<{ sessions: Session[] }>> =>
    request(`/api/sessions/team/${teamId}${templates ? '?templates=1' : ''}`, { token }),

  session: (token: string, sessionId: string): Promise<ApiResult<SessionDetail>> =>
    request(`/api/sessions/${sessionId}`, { token }),

  createSession: (
    token: string,
    teamId: string,
    body: { name: string; notes?: string; date: DayKey | null; isTemplate?: boolean },
  ): Promise<ApiResult<{ session: Session; tasks: SessionTask[] }>> =>
    request('/api/sessions', { method: 'POST', token, body: { ...body, teamId } }),

  updateSession: (
    token: string,
    sessionId: string,
    body: { name?: string; notes?: string; date?: DayKey | null; isTemplate?: boolean; archived?: boolean },
  ): Promise<ApiResult<{ session: Session }>> =>
    request(`/api/sessions/${sessionId}`, { method: 'PATCH', token, body }),

  addTask: (
    token: string,
    sessionId: string,
    body: { title: string; detail?: string; kind: TaskKind; target: number },
  ): Promise<ApiResult<{ task: SessionTask }>> =>
    request(`/api/sessions/${sessionId}/tasks`, { method: 'POST', token, body }),

  updateTask: (
    token: string,
    sessionId: string,
    taskId: string,
    body: { title: string; detail?: string; kind: TaskKind; target: number },
  ): Promise<ApiResult<{ task: SessionTask }>> =>
    request(`/api/sessions/${sessionId}/tasks/${taskId}`, { method: 'PATCH', token, body }),

  removeTask: (token: string, sessionId: string, taskId: string): Promise<ApiResult<null>> =>
    request(`/api/sessions/${sessionId}/tasks/${taskId}`, { method: 'DELETE', token }),

  /* ------------------------------------------------------------ verbs */

  /** Safe to repeat: only missing assignments are created. */
  handOut: (
    token: string,
    sessionId: string,
    assigneeUserIds: string[],
    dueDate?: DayKey,
  ): Promise<ApiResult<{ assignments: Assignment[]; added: number }>> =>
    request(`/api/sessions/${sessionId}/handout`, {
      method: 'POST',
      token,
      body: { assigneeUserIds, dueDate },
    }),

  startFromTemplate: (
    token: string,
    templateId: string,
    body: { date: DayKey; name?: string },
  ): Promise<ApiResult<{ session: Session; tasks: SessionTask[] }>> =>
    request(`/api/sessions/${templateId}/start`, { method: 'POST', token, body }),

  saveAsTemplate: (
    token: string,
    sessionId: string,
    name?: string,
  ): Promise<ApiResult<{ session: Session; tasks: SessionTask[] }>> =>
    request(`/api/sessions/${sessionId}/save-as-template`, { method: 'POST', token, body: { name } }),

  /* ------------------------------------------------------------- work */

  /** The caller's own assigned work, across every team. */
  myWork: (token: string): Promise<ApiResult<{ assignments: Assignment[] }>> =>
    request('/api/work/mine', { token }),

  /** Coach: the whole squad's rows. Athlete: their own. Same call. */
  teamWork: (
    token: string,
    teamId: string,
  ): Promise<ApiResult<{ assignments: Assignment[]; role: TeamRole }>> =>
    request(`/api/work/teams/${teamId}`, { token }),

  logResult: (
    token: string,
    assignmentId: string,
    body: { amount: number; done: boolean; notes?: string },
  ): Promise<ApiResult<{ result: Result }>> =>
    request(`/api/work/assignments/${assignmentId}/result`, { method: 'PUT', token, body }),
};
