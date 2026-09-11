/**
 * Plain-language explanations of the workbook's jargon.
 *
 * Written for someone who has never set foot in a gym and does not know what
 * "WOD" or "AMRAP" means. Rules for anything added here:
 *
 *  - lead with what the word means, not why it matters
 *  - no jargon inside the explanation of a piece of jargon
 *  - say what to type in the box, because that is the actual question
 *  - never imply the user is behind, or that a fuller page is a better one
 *
 * One file so the whole vocabulary can be read at once and translated in one
 * pass if the app ever gains an i18n layer.
 */

export type ExplainerKey =
  | 'wod'
  | 'energySystems'
  | 'plusOne'
  | 'decision'
  | 'habit'
  | 'theme'
  | 'story'
  | 'skill'
  | 'benchmark';

export type Explainer = {
  /** The term as it appears on screen. */
  term: string;
  /** One sentence. This is what most people will read and nothing else. */
  short: string;
  /** Optional detail, shown under the sentence in the info sheet. */
  detail?: string;
};

export const EXPLAINERS: Record<ExplainerKey, Explainer> = {
  wod: {
    term: 'WOD',
    short: 'Workout of the Day — whatever training you did, written down.',
    detail:
      'It is just a name for today’s session. List the exercises, how many you did, and how it went. There is no right format, and a workout you did not write down still counted.',
  },
  energySystems: {
    term: 'M / G / W',
    short: 'Three kinds of training, so you can see what you have been favouring.',
    detail:
      'M is anything steady that gets you breathing — running, rowing, cycling, skipping. G is moving your own body: press-ups, pull-ups, squats, sit-ups. W is lifting something: a barbell, dumbbells, a kettlebell. Tag as many as apply, or none at all.',
  },
  plusOne: {
    term: 'Plus One',
    short: 'Six parts of a life. Tick the ones you gave something to today.',
    detail:
      'Not scores and not goals — just a note of where your attention went. One tick is a complete day’s answer. Six is not better than one, it is only different.',
  },
  decision: {
    term: 'Decision',
    short: 'One thing you are choosing to do today.',
    detail:
      'A single specific choice, not a plan for the week — "call my brother", "no phone after ten". Mark it yes or no tonight, or leave it unmarked. Unmarked is not a failure; it just means you did not answer.',
  },
  habit: {
    term: 'Habit',
    short: 'The one thing you are trying to repeat every day.',
    detail:
      'Keep it small enough to do on your worst day. This is today’s line only — the Habits screen is where standing habits and their streaks live.',
  },
  theme: {
    term: 'Theme',
    short: 'A few words for what today is about.',
    detail:
      'A word or a short phrase you want to keep in mind — "patience", "finish what I start". Skip it freely; it exists to be glanced at later, not filled in.',
  },
  story: {
    term: 'Story / Scripture',
    short: 'Anything you read today that you want to remember.',
    detail:
      'A passage, a quote, a line from a book, or nothing at all. This box has no expectations attached to it.',
  },
  benchmark: {
    term: 'Benchmark',
    short: 'A fixed test you repeat later to see whether anything changed.',
    detail:
      'Do it once and write down what you managed. Do the same test again in a few weeks and compare. The first number is not a verdict on you — it is only the thing the second number gets measured against.',
  },
  skill: {
    term: 'Skill',
    short: 'Something you practised deliberately, apart from the workout.',
    detail:
      'The thing you were working on rather than just doing — a movement you are learning, an instrument, a language.',
  },
};

/** Labels for the six Plus One dimensions, in the order the workbook prints. */
export const PLUS_ONE_LABEL = {
  physical: 'Physical',
  intellectual: 'Intellectual',
  spiritual: 'Spiritual',
  emotional: 'Emotional',
  social: 'Social',
  environmental: 'Environmental',
} as const;

/**
 * A one-line hint per dimension, shown under the label. Deliberately concrete
 * and undemanding — the point is to make the box answerable in two seconds.
 */
export const PLUS_ONE_HINT = {
  physical: 'Moved, rested, ate, slept',
  intellectual: 'Read, studied, thought something through',
  spiritual: 'Prayer, stillness, reflection',
  emotional: 'Noticed how you felt, or dealt with it',
  social: 'Time with someone who matters',
  environmental: 'Tidied, fixed or improved a space',
} as const;
