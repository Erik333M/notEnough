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
  /** A path for `avatarSource`, or null. Travels with the name. */
  avatarUrl: string | null;
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
  /**
   * Whether teammates can see each other's results for this session.
   *
   * Off by default and set per session: an open board for Tuesday's
   * conditioning and a private one for 1RM testing are both reasonable, and
   * only the coach knows which is which.
   */
  shareResults: boolean;
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

export type ShareKind = 'streak' | 'personalBest' | 'habit' | 'work';

/**
 * An achievement someone chose to show their team.
 *
 * A flat snapshot, never a pointer into the author's data — the feed says what
 * it says and stops there.
 */
export type Share = {
  id: string;
  teamId: string;
  userId: string;
  /** Captured when posted, so a later rename does not rewrite old posts. */
  authorName: string;
  kind: ShareKind;
  achievementId: string;
  title: string;
  detail: string;
  value: number;
  achievedAt: DayKey;
  note: string;
  createdAt: string;
};

export type ChallengeScope = 'daily' | 'weekly' | 'monthly';

export type Challenge = {
  id: string;
  teamId: string;
  scope: ChallengeScope;
  title: string;
  description: string;
  /** Free text a coach wrote. The app awards nothing itself. */
  reward: string;
  target: number;
  periodStart: DayKey;
  periodEnd: DayKey;
  createdBy: string;
  createdAt: string;
  archived: boolean;
};

/**
 * One person's place on a board.
 *
 * A name and a number. There is deliberately nothing here that points back at
 * the training the number came from.
 */
export type ChallengeEntry = {
  id: string;
  challengeId: string;
  userId: string;
  name: string;
  score: number;
  /** Shared by everyone on the same score — no invented tie-breaks. */
  rank?: number;
  updatedAt: string;
};

export type ChallengeSummary = {
  challenge: Challenge;
  joined: boolean;
  myScore: number;
  entrants: number;
};

export type ChallengeDetail = {
  challenge: Challenge;
  entries: ChallengeEntry[];
  role: TeamRole;
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
    body: { name: string; notes?: string; date: DayKey | null; isTemplate?: boolean; shareResults?: boolean },
  ): Promise<ApiResult<{ session: Session; tasks: SessionTask[] }>> =>
    request('/api/sessions', { method: 'POST', token, body: { ...body, teamId } }),

  updateSession: (
    token: string,
    sessionId: string,
    body: {
      name?: string;
      notes?: string;
      date?: DayKey | null;
      isTemplate?: boolean;
      archived?: boolean;
      shareResults?: boolean;
    },
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

  /* ----------------------------------------------------------- shares */

  /**
   * Publish one achievement to one team.
   *
   * Only ever called from an explicit tap. The payload is a snapshot — what it
   * says is all it is — so a feed can never be read back into anybody's
   * training.
   */
  share: (
    token: string,
    teamId: string,
    body: {
      kind: ShareKind;
      achievementId: string;
      title: string;
      detail?: string;
      value: number;
      achievedAt: DayKey;
      note?: string;
    },
  ): Promise<ApiResult<{ share: Share }>> =>
    request(`/api/teams/${teamId}/shares`, { method: 'POST', token, body }),

  shares: (token: string, teamId: string): Promise<ApiResult<{ shares: Share[] }>> =>
    request(`/api/teams/${teamId}/shares`, { token }),

  /** The author, or a coach keeping their feed clean. */
  removeShare: (token: string, teamId: string, shareId: string): Promise<ApiResult<null>> =>
    request(`/api/teams/${teamId}/shares/${shareId}`, { method: 'DELETE', token }),

  /* -------------------------------------------------------- challenges */

  challenges: (
    token: string,
    teamId: string,
  ): Promise<ApiResult<{ challenges: ChallengeSummary[] }>> =>
    request(`/api/teams/${teamId}/challenges`, { token }),

  createChallenge: (
    token: string,
    teamId: string,
    body: {
      scope: ChallengeScope;
      title: string;
      description?: string;
      reward?: string;
      target: number;
      periodStart: DayKey;
      periodEnd: DayKey;
    },
  ): Promise<ApiResult<{ challenge: Challenge }>> =>
    request(`/api/teams/${teamId}/challenges`, { method: 'POST', token, body }),

  challenge: (token: string, challengeId: string): Promise<ApiResult<ChallengeDetail>> =>
    request(`/api/teams/detail/${challengeId}`, { token }),

  /** Joining is the consent: until you do, you have no entry and no rank. */
  joinChallenge: (token: string, challengeId: string): Promise<ApiResult<{ entry: ChallengeEntry }>> =>
    request(`/api/teams/detail/${challengeId}/join`, { method: 'POST', token }),

  leaveChallenge: (token: string, challengeId: string): Promise<ApiResult<null>> =>
    request(`/api/teams/detail/${challengeId}/leave`, { method: 'DELETE', token }),

  /** The number only. What it was computed from never leaves the device. */
  reportScore: (
    token: string,
    challengeId: string,
    score: number,
  ): Promise<ApiResult<{ entry: ChallengeEntry }>> =>
    request(`/api/teams/detail/${challengeId}/score`, { method: 'PUT', token, body: { score } }),

  closeChallenge: (token: string, challengeId: string): Promise<ApiResult<{ challenge: Challenge }>> =>
    request(`/api/teams/detail/${challengeId}`, { method: 'PATCH', token, body: { archived: true } }),

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
