/**
 * Success Journey — every domain type for the feature, in one place.
 *
 * The workbook this models is six loosely-coupled modules (daily entry,
 * movements, benchmarks, measurements, habits, intake) that share one thing:
 * a local calendar day. That shared key is `DayKey`, and it is the only
 * required field anywhere in the feature — everything else is optional by
 * design, because a half-filled page still has to be a valid page.
 */

/**
 * A local-time `YYYY-MM-DD`, produced by `dayKey()` in lib/time.
 *
 * Treated as an opaque string for its whole life: authored once from the
 * device's local date and never converted back to a `Date` for storage. That
 * is what makes a timezone change harmless — flying to another zone changes
 * which key "today" resolves to, but no stored key moves, so an entry can
 * neither be duplicated nor orphaned.
 */
export type DayKey = string;

/** Epoch milliseconds. */
export type Timestamp = number;

/* --------------------------------------------------------------------- WOD */

/**
 * The workbook's three energy-system tags.
 * M = monostructural (cardio), G = gymnastics, W = weightlifting.
 */
export type WodTag = 'M' | 'G' | 'W';

export const WOD_TAGS: readonly WodTag[] = ['M', 'G', 'W'];

/** The workbook prints exactly four round boxes. */
export type WodRounds = 1 | 2 | 3 | 4;

export const WOD_ROUNDS: readonly WodRounds[] = [1, 2, 3, 4];

/**
 * One movement line of a workout.
 *
 * `movementId` and `freeText` are deliberately both present rather than a
 * union: a line typed before its movement exists in the catalogue keeps its
 * text, and picking a catalogue entry later fills the id without destroying
 * what the user wrote. Exactly one is rendered, `movementId` winning.
 */
export type WodLine = {
  id: string;
  /** Null while the line is still blank — the row renders, the number does not. */
  reps: number | null;
  /** References `Movement.id`, from the seed catalogue or a custom movement. */
  movementId: string | null;
  /** What the user typed. Retained even once `movementId` is set. */
  freeText: string;
  /** Canonical kilograms. Converted at the input edge, never in storage. */
  weightKg: number | null;
  notes: string;
};

export type Wod = {
  tags: WodTag[];
  rounds: WodRounds | null;
  lines: WodLine[];
  /** "3 rounds for time", "AMRAP 12" — free text so any format fits. */
  structure: string;
  /** Time, rounds, reps — free text so any scoring style fits. */
  result: string;
};

/* -------------------------------------------------------------- daily entry */

/**
 * The six Plus One dimensions. A closed set: the workbook prints these six and
 * the page is a fixed grid, so users tick them rather than defining them.
 */
export type PlusOneKey =
  | 'physical'
  | 'intellectual'
  | 'spiritual'
  | 'emotional'
  | 'social'
  | 'environmental';

export type PlusOne = Record<PlusOneKey, boolean>;

/**
 * A "I will …" line with its own Done box. Shared by Decision and Habit, which
 * are the same shape on the page and behave identically.
 *
 * `done: null` is untouched — distinct from `false`, which is an explicit "no".
 * The workbook prints Yes and No as separate boxes, and conflating "I did not
 * answer" with "I failed" is exactly the guilt this feature must not create.
 */
export type Intention = {
  text: string;
  done: boolean | null;
};

/**
 * One calendar day. Created lazily: opening a date does not write one, so
 * scrolling back through history leaves no trail of empty entries.
 */
export type DailyEntry = {
  date: DayKey;
  theme: string;
  story: string;
  /** Null until the WOD card is opened, which keeps day one uncluttered. */
  wod: Wod | null;
  skill: string;
  decision: Intention;
  habit: Intention;
  plusOne: PlusOne;
  updatedAt: Timestamp;
};

/* ------------------------------------------------------------------ movements */

export type MovementCategory =
  | 'strength'
  | 'weightlifting'
  | 'gymnastics'
  | 'monostructural';

export type Movement = {
  id: string;
  name: string;
  category: MovementCategory;
  /** Alternate spellings folded into search ("t2b", "du"). */
  aliases: string[];
  /** True only for movements the user added; seeded ones are read-only. */
  isCustom: boolean;
};

/* ----------------------------------------------------------------- benchmarks */

export type BenchmarkGroup = 'monostructural' | 'gymnastics' | 'weightlifting';

/**
 * How a benchmark is scored, which also decides which direction is an
 * improvement — see `isBetter()` in benchmarks.ts. Storing the metric rather
 * than a per-benchmark "lower is better" flag keeps the two from disagreeing.
 *
 * time     — seconds, lower is better (a 400 m sprint)
 * duration — seconds, higher is better (a max plank hold)
 * reps     — count, higher is better
 * weight   — canonical kilograms, higher is better
 */
export type BenchmarkMetric = 'time' | 'duration' | 'reps' | 'weight';

export type BenchmarkDefinition = {
  id: string;
  name: string;
  group: BenchmarkGroup;
  metric: BenchmarkMetric;
  isCustom: boolean;
};

export type BenchmarkResult = {
  id: string;
  definitionId: string;
  date: DayKey;
  /** Seconds, reps or kilograms depending on the definition's metric. */
  value: number;
  notes: string;
};

/* --------------------------------------------------------------- measurements */

export type UnitSystem = 'metric' | 'imperial';

/**
 * Captured once and editable, not a dated series. Every field is nullable: a
 * user who only knows their weight must still get a usable screen.
 */
export type MeasurementBaseline = {
  heightCm: number | null;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  restingHeartRate: number | null;
  /** Age-based reference figure the workbook asks for. */
  referenceHeartRate: number | null;
};

/**
 * One dated set of readings. Every metric is optional and independently
 * nullable, so logging only a weight writes one number, not eight nulls'
 * worth of pressure on the form.
 */
export type MeasurementEntry = {
  id: string;
  date: DayKey;
  weightKg: number | null;
  bodyFatPct: number | null;
  waterPct: number | null;
  musclePct: number | null;
  heartRateBefore: number | null;
  heartRateAfter: number | null;
  /** Time to return to normal breathing, stored as seconds. */
  recoverySeconds: number | null;
  workoutsPerWeek: number | null;
};

/** The measurement fields that can be charted over time. */
export type MeasurementMetricKey =
  | 'weightKg'
  | 'bodyFatPct'
  | 'waterPct'
  | 'musclePct'
  | 'heartRateBefore'
  | 'heartRateAfter'
  | 'recoverySeconds'
  | 'workoutsPerWeek';

/* --------------------------------------------------------------------- habits */

export type HabitGroup = 'health' | 'mind' | 'finance' | 'relationships' | 'environment';

/** A suggestion from the seed file. Adopting one copies it into `HabitState`. */
export type HabitTemplate = {
  id: string;
  title: string;
  group: HabitGroup;
};

export type Habit = {
  id: string;
  /** The template it came from, or null when the user wrote their own. */
  templateId: string | null;
  title: string;
  group: HabitGroup;
  createdAt: Timestamp;
  /** Dropped habits archive rather than delete, so their history survives. */
  archived: boolean;
};

/** dayKey -> habitId -> true. Only ticks are stored; absence is "not done". */
export type HabitChecks = Record<DayKey, Record<string, boolean>>;

/* --------------------------------------------------------------------- intake */

/**
 * The baseline questionnaire.
 *
 * Sensitive personal data: injuries, medical conditions and an emergency
 * contact. Persisted under its own device-local storage key, never merged into
 * `JourneyState`, never sent to the server, and never logged or included in
 * an analytics payload. See intake.ts — the separation is the enforcement.
 */
export type Intake = {
  completedAt: Timestamp | null;
  /** True when the user chose to skip rather than answer. */
  skipped: boolean;
  currentlyTraining: boolean | null;
  daysPerWeek: number | null;
  sports: string;
  lastWorkoutDate: DayKey | null;
  injuries: string;
  medicalConditions: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

/* ---------------------------------------------------------------------- state */

/**
 * The feature's slice of `AppState`.
 *
 * Two storage decisions worth naming:
 *
 * 1. `movements` and `benchmarks` hold *custom entries only*. The seed
 *    catalogues are merged in at read time, so replacing a seed JSON file
 *    reaches every existing install instead of stranding a stale copy in each
 *    user's saved state.
 * 2. `entries` is keyed by `DayKey` rather than an array, so writing today is
 *    O(1) and cannot depend on how much history sits behind it.
 */
export type JourneyState = {
  schemaVersion: number;
  entries: Record<DayKey, DailyEntry>;
  /** Custom movements only. */
  movements: Movement[];
  /** Custom benchmark definitions only. */
  benchmarks: BenchmarkDefinition[];
  results: BenchmarkResult[];
  baseline: MeasurementBaseline;
  measurements: MeasurementEntry[];
  habits: Habit[];
  checks: HabitChecks;
  units: UnitSystem;
};
