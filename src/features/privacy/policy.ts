import type { IconName } from '../../state/types';
import type { AccentName } from '../../theme/theme';

/**
 * The privacy policy, as data.
 *
 * Kept apart from the screen so the wording can be read, reviewed and changed
 * without touching layout — and so it stays verifiably in step with the
 * repository's PRIVACY.md, which carries the same sections in the same order.
 *
 * Every claim here has to be true of the code. If a future change starts
 * sending something new, this file is part of that change.
 */

export type PolicyRow = { term: string; detail: string };

export type PolicySection = {
  id: string;
  title: string;
  icon: IconName;
  accent: AccentName;
  /** Paragraphs, shown in order above any rows. */
  body: string[];
  /** Optional label/value pairs, rendered as a definition list. */
  rows?: PolicyRow[];
};

export const POLICY_UPDATED = '19 September 2026';

export const POLICY_SUMMARY = [
  'Everything you write is kept on your device first. The app works fully offline.',
  'Your injuries, medical conditions and emergency contact are never synced.',
  'A coach sees only the work they set you — never your own training.',
  'No analytics, no tracking, no advertising, no third-party SDKs.',
];

export const POLICY_SECTIONS: PolicySection[] = [
  {
    id: 'device',
    title: 'Kept on your device',
    icon: 'phone-portrait-outline',
    accent: 'violet',
    body: [
      'The app stores its working copy locally, which is why every screen keeps working with no network at all.',
    ],
    rows: [
      {
        term: 'Your journal',
        detail:
          'Daily entries, workouts, benchmarks, measurements, habits, goals and sessions.',
      },
      {
        term: 'Your sign-in token',
        detail: 'Held in the device keystore. Your password is never stored on the device.',
      },
      {
        term: 'Your starting answers',
        detail: 'In the keystore too, under a separate key. See “Health information” below.',
      },
      {
        term: 'Reminders',
        detail: 'Scheduled by the operating system on this device.',
      },
    ],
  },
  {
    id: 'server',
    title: 'Sent to the server',
    icon: 'cloud-upload-outline',
    accent: 'cyan',
    body: [
      'Only if you create an account, and only when the server is reachable. The server is the small service that ships with this project — run by you or by whoever operates the app, with no external database and no third-party processor.',
    ],
    rows: [
      { term: 'Name and email', detail: 'To identify your account.' },
      {
        term: 'Password',
        detail:
          'Sent when you register or sign in, then stored only as a scrypt hash with a per-account salt. Never in plain text.',
      },
      {
        term: 'Your journal state',
        detail:
          'So the same account shows the same journal on another device. Stored as one private block per account that the server does not read into and cannot serve to anyone else.',
      },
      {
        term: 'Your profile picture, only if you set one',
        detail:
          'Stored as an image file on the server and shown to your friends and to people on a team you share — the same people who can already see your name. There is no picture until you choose one, and removing it deletes the file.',
      },
      {
        term: 'Anything you post to your friends',
        detail:
          'An achievement you chose to show them: two lines, your name and the date. Who can see it is worked out from your friendships each time the feed is read, so removing somebody as a friend takes your posts back from them.',
      },
      {
        term: 'Messages you post to an event channel',
        detail:
          'Only the staff of an event can post; everybody at that event reads it. Stored on the server so people who were not looking still see it. Anyone can delete their own message, and event staff can delete any of them.',
      },
      {
        term: 'Team work, only if you are in a team',
        detail:
          'Sessions a coach set you and the results you logged against them. Kept separately from your journal, because more than one person can see it. See "If you join a team".',
      },
    ],
  },
  {
    id: 'health',
    title: 'Health information stays here',
    icon: 'lock-closed-outline',
    accent: 'lime',
    body: [
      'The starting questions cover injuries, medical conditions and who to contact in an emergency. Those answers are treated differently from everything else.',
      'They are written to the secure keystore under their own key, entirely outside the structure that gets synced — there is no code path that can upload them. Nothing about them is written to logs, and every question is optional.',
      'You can delete them at any time from Journey → Progress. Deletion is immediate and cannot be undone.',
    ],
  },
  {
    id: 'teams',
    title: 'If you join a team',
    icon: 'people-outline',
    accent: 'violet',
    body: [
      'Teams are optional and off until you join or create one. If you never do, nothing in this section applies to you and nobody can see anything of yours.',
      'When a coach sets you work, that assignment and the result you log against it are visible to them. That is the whole of what they see. Your own training — your journal, goals, habits, measurements and your answers to the starting questions — is never visible to a coach, in any team, at any time.',
      'This is enforced by how the data is stored rather than by a setting. Your own training lives in a private area the server does not read into, and the code that decides who may see a result is given the assignment, never a person — so there is no way to ask the server for someone\'s training, and no request that could return it.',
      'A coach can open a single session so teammates see each other\'s results on it. That is off unless the coach turns it on, applies only to the one session, and can be turned off again.',
      'Challenges work the same way round. Nobody is entered because they are on a roster: joining publishes one number — your total for that challenge — and leaving takes it away again.',
    ],
    rows: [
      {
        term: 'What your coach sees',
        detail:
          'Work they set you, in their own team, and what you recorded against it. Nothing else.',
      },
      {
        term: 'What other members see',
        detail:
          'Your name and role on the roster. Your email address is never shown to anyone, including your coach.',
      },
      {
        term: 'Coaches in your other teams',
        detail:
          'See nothing of this team. Access follows the work, not the person, so being on two rosters keeps two separate views.',
      },
      {
        term: 'A challenge you join',
        detail:
          'Your total for that challenge, and your name, on that challenge\'s board. The number is worked out on this device and only the total is sent — never what it was made of. No entry, no board, until you choose to join.',
      },
      {
        term: 'Leaving a team',
        detail:
          'Ends their access immediately. Everything you recorded stays yours and stays in your account.',
      },
      {
        term: 'Deleting your account',
        detail:
          'Removes your memberships, your assignments and your results along with everything else.',
      },
    ],
  },
  {
    id: 'events',
    title: 'If you join an event',
    icon: 'calendar-outline',
    accent: 'cyan',
    body: [
      'A camp or a training week is a team with dates on it, so everything in "If you join a team" applies to it too. Three things are particular to events.',
      'The age group on an event is a label, not a check. The app holds no birthdates and never asks your age — it is there so somebody reading the event knows who it is meant for.',
      'Statistics recorded in an event — goals, cards, whatever the organiser chose to count — are visible to everybody at that event. They are figures from its games, kept separately from your own training, which nobody at the event can see.',
      'The channel carries messages from the event staff to everybody there. Campers cannot post to it. That is deliberate: an app that let children message each other would need moderation, reporting and blocking, and this one has none of those.',
    ],
  },
  {
    id: 'never',
    title: 'What the app never does',
    icon: 'close-circle-outline',
    accent: 'rose',
    body: [],
    rows: [
      { term: 'No analytics', detail: 'There is no analytics or telemetry SDK in the project.' },
      { term: 'No advertising', detail: 'Nothing is sold or shared for marketing.' },
      {
        term: 'No push service',
        detail:
          'Reminders are scheduled locally. No push token is collected and no server sends you messages.',
      },
      {
        term: 'No location',
        detail:
          'The run timer counts elapsed time and a distance you enter yourself. It does not read GPS.',
      },
      { term: 'No contacts', detail: 'The app never asks for your address book.' },
      {
        term: 'No camera or microphone',
        detail:
          'The photo picker is configured without them, so the app cannot open your camera or record audio.',
      },
      {
        term: 'No photo library access until you ask for it',
        detail:
          'Permission is requested at the moment you tap to set a profile picture, never at launch — and only the single image you choose is read. Refusing is a normal answer: you keep your initials.',
      },
    ],
  },
  {
    id: 'controls',
    title: 'What you can delete',
    icon: 'options-outline',
    accent: 'amber',
    body: [],
    rows: [
      {
        term: 'Your health answers',
        detail: 'Journey → Progress → Delete my answers. Removed from the keystore at once.',
      },
      {
        term: 'Your whole account',
        detail:
          'Settings → Delete account. Removes both your account and your synced journal from the server.',
      },
      {
        term: 'Your profile picture',
        detail:
          'You → Remove photo. The file is deleted from the server, not just hidden.',
      },
      {
        term: 'Something you posted to your friends',
        detail: 'Tap the cross on your own post. It is deleted, not hidden.',
      },
      {
        term: 'A message you posted',
        detail:
          'Open the event channel and tap your own message. It is deleted for everybody, not hidden.',
      },
      {
        term: 'Stop syncing',
        detail: 'Settings → Sign out. The token is cleared and the app keeps working offline.',
      },
      {
        term: 'Your coach\'s access',
        detail:
          'Teams → open the team → Leave. Access ends at once; your results stay with you.',
      },
      { term: 'Never sync at all', detail: 'Do not sign in. Nothing is sent anywhere.' },
    ],
  },
  {
    id: 'security',
    title: 'Security and retention',
    icon: 'shield-checkmark-outline',
    accent: 'cyan',
    body: [
      'Passwords are hashed with scrypt and a per-account salt on the server. Tokens and health answers live in the device keystore rather than ordinary storage.',
      'Your journal stays on the server while the account exists; deleting the account removes it. If you run the server yourself, serve it over HTTPS and set a real signing secret — over plain HTTP on an untrusted network, traffic between the app and the server can be read by others.',
    ],
  },
];
