/**
 * Baseline intake questionnaire — sensitive personal data.
 *
 * This module is the enforcement of that claim, not just a comment about it:
 *
 *  - It is stored under its own key through `lib/secure`, which is SecureStore
 *    (Keychain / Keystore) on device, so it lives nowhere near the synced
 *    `AppState` blob.
 *  - It is never part of `JourneyState`, so it cannot reach `toRemote()` and
 *    cannot be uploaded by an existing or future sync path.
 *  - Nothing here logs a field value. Do not add a `console.log` to this file,
 *    and do not pass an `Intake` into an analytics call.
 *  - `clearIntake()` exists so a user can withdraw the data entirely.
 *
 * Injuries, medical conditions and an emergency contact are the fields that
 * make this necessary. They are answers to "what should someone know if you
 * get hurt", not fitness telemetry.
 */

import { secureDelete, secureGet, secureSet } from '../../lib/secure';
import { asBoundedNumber, asDayKey, asNullableBool, asNumber, asString, isRecord } from './coerce';
import { emptyIntake } from './factory';
import type { Intake } from './types';

/**
 * Per-user key. SecureStore values are size-limited on iOS, which is why the
 * free-text caps below are tight — a silently truncated Keychain write would
 * be a bad way to discover the limit.
 */
export function intakeKey(userId: string): string {
  return `ne.journey.intake.v1.${userId}`;
}

const SPORTS_MAX = 160;
const FREE_TEXT_MAX = 400;
const NAME_MAX = 80;
const PHONE_MAX = 40;

/** Same total-function rule as the rest of the feature: never throws. */
export function readIntake(raw: unknown): Intake {
  const base = emptyIntake();
  if (!isRecord(raw)) return base;

  return {
    completedAt: asNumber(raw.completedAt, 0) || null,
    skipped: raw.skipped === true,
    currentlyTraining: asNullableBool(raw.currentlyTraining),
    daysPerWeek: asBoundedNumber(raw.daysPerWeek, 0, 14),
    sports: asString(raw.sports, '', SPORTS_MAX),
    lastWorkoutDate: asDayKey(raw.lastWorkoutDate),
    injuries: asString(raw.injuries, '', FREE_TEXT_MAX),
    medicalConditions: asString(raw.medicalConditions, '', FREE_TEXT_MAX),
    emergencyContactName: asString(raw.emergencyContactName, '', NAME_MAX),
    emergencyContactPhone: asString(raw.emergencyContactPhone, '', PHONE_MAX),
  };
}

/** Trims every field to its cap before it is written. */
function sanitise(intake: Intake): Intake {
  return {
    ...intake,
    sports: intake.sports.slice(0, SPORTS_MAX),
    injuries: intake.injuries.slice(0, FREE_TEXT_MAX),
    medicalConditions: intake.medicalConditions.slice(0, FREE_TEXT_MAX),
    emergencyContactName: intake.emergencyContactName.slice(0, NAME_MAX),
    emergencyContactPhone: intake.emergencyContactPhone.slice(0, PHONE_MAX),
  };
}

export async function loadIntake(userId: string): Promise<Intake> {
  const raw = await secureGet<unknown>(intakeKey(userId), null);
  return readIntake(raw);
}

export async function saveIntake(userId: string, intake: Intake): Promise<void> {
  await secureSet(intakeKey(userId), sanitise(intake));
}

/** Records that the user was asked and declined, storing no answers. */
export async function skipIntake(userId: string): Promise<Intake> {
  const skipped: Intake = { ...emptyIntake(), skipped: true, completedAt: Date.now() };
  await secureSet(intakeKey(userId), skipped);
  return skipped;
}

/** Withdraws the data. Irreversible, and meant to be. */
export async function clearIntake(userId: string): Promise<void> {
  await secureDelete(intakeKey(userId));
}

/** Whether onboarding should still ask. Skipping counts as answered. */
export function intakeAnswered(intake: Intake): boolean {
  return intake.completedAt !== null || intake.skipped;
}

/** True when the user actually provided something, as opposed to skipping. */
export function intakeHasAnswers(intake: Intake): boolean {
  return (
    intake.currentlyTraining !== null ||
    intake.daysPerWeek !== null ||
    intake.sports.trim().length > 0 ||
    intake.lastWorkoutDate !== null ||
    intake.injuries.trim().length > 0 ||
    intake.medicalConditions.trim().length > 0 ||
    intake.emergencyContactName.trim().length > 0 ||
    intake.emergencyContactPhone.trim().length > 0
  );
}
