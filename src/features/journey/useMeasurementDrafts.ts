import { useCallback, useEffect, useMemo, useState } from 'react';

import { dayKey } from '../../lib/time';
import { MEASUREMENT_METRICS, metricBounds } from '../../state/journey/measurements';
import type {
  DayKey,
  MeasurementEntry,
  MeasurementMetricKey,
  UnitSystem,
} from '../../state/journey/types';
import { displayWeight, roundTo, storeWeight } from '../../state/journey/units';
import {
  emptyFieldDraft,
  numberFromDraft,
  type FieldDraft,
} from './MeasurementField';

/**
 * Form state for a set of readings.
 *
 * Split out of the sheet because there are three separate concerns tangled
 * here — which fields are on screen, what is typed in them, and how that
 * converts to stored values — and each one has an edge case worth naming:
 *
 *  - weight is typed in the display unit but bounded and stored in kilograms
 *  - removing a field must clear it, or a hidden value would still be saved
 *  - editing an existing reading has to reveal exactly the fields it holds
 */
type Drafts = Record<MeasurementMetricKey, FieldDraft>;

/** Weight is the field almost everyone logs, so it is never hidden. */
export const ALWAYS_SHOWN: MeasurementMetricKey = 'weightKg';

function emptyDrafts(): Drafts {
  const out = {} as Drafts;
  for (const metric of MEASUREMENT_METRICS) out[metric.key] = emptyFieldDraft();
  return out;
}

export type ParseOutcome =
  | { ok: true; values: Partial<MeasurementEntry> }
  | { ok: false; message: string };

export function useMeasurementDrafts(
  visible: boolean,
  existing: MeasurementEntry | null,
  units: UnitSystem,
) {
  const [drafts, setDrafts] = useState<Drafts>(emptyDrafts);
  const [shown, setShown] = useState<MeasurementMetricKey[]>([ALWAYS_SHOWN]);
  const [date, setDate] = useState<DayKey>(dayKey());

  // Reset on open so a cancelled entry never leaks into the next one.
  useEffect(() => {
    if (!visible) return;

    const next = emptyDrafts();
    const visibleKeys: MeasurementMetricKey[] = [ALWAYS_SHOWN];

    if (existing) {
      for (const metric of MEASUREMENT_METRICS) {
        const raw = existing[metric.key];
        if (raw === null) continue;
        const shownValue =
          metric.key === 'weightKg' ? roundTo(displayWeight(raw, units) ?? raw, 1) : raw;
        next[metric.key] =
          metric.input === 'duration'
            ? durationDraft(shownValue)
            : { minutes: '', amount: `${shownValue}` };
        if (metric.key !== ALWAYS_SHOWN) visibleKeys.push(metric.key);
      }
    }

    setDrafts(next);
    setShown(visibleKeys);
    setDate(existing?.date ?? dayKey());
  }, [visible, existing, units]);

  const hidden = useMemo(
    () => MEASUREMENT_METRICS.filter((m) => !shown.includes(m.key)),
    [shown],
  );

  const visibleMetrics = useMemo(
    () => MEASUREMENT_METRICS.filter((m) => shown.includes(m.key)),
    [shown],
  );

  const setDraft = useCallback((key: MeasurementMetricKey, draft: FieldDraft) => {
    setDrafts((current) => ({ ...current, [key]: draft }));
  }, []);

  const addField = useCallback((key: MeasurementMetricKey) => {
    setShown((current) => (current.includes(key) ? current : [...current, key]));
  }, []);

  const removeField = useCallback((key: MeasurementMetricKey) => {
    setShown((current) => current.filter((k) => k !== key));
    // Clear it too, so a removed field is never silently saved.
    setDrafts((current) => ({ ...current, [key]: emptyFieldDraft() }));
  }, []);

  /** Converts the boxes into storable values, or explains what is wrong. */
  const parse = useCallback((): ParseOutcome => {
    const values: Partial<MeasurementEntry> = {};
    let any = false;

    for (const metric of MEASUREMENT_METRICS) {
      const parsed = numberFromDraft(drafts[metric.key], metric.input);
      if (parsed === null) {
        values[metric.key] = null;
        continue;
      }

      const stored =
        metric.key === 'weightKg' ? (storeWeight(parsed, units) ?? parsed) : parsed;
      const [min, max] = metricBounds(metric.key);

      if (stored < min || stored > max) {
        return { ok: false, message: `${metric.label} looks out of range. Check it and try again.` };
      }

      values[metric.key] = stored;
      any = true;
    }

    if (!any) return { ok: false, message: 'Fill in at least one reading.' };
    return { ok: true, values };
  }, [drafts, units]);

  return {
    drafts,
    date,
    setDate,
    hidden,
    visibleMetrics,
    setDraft,
    addField,
    removeField,
    parse,
  };
}

function durationDraft(seconds: number): FieldDraft {
  const total = Math.max(0, Math.round(seconds));
  return { minutes: `${Math.floor(total / 60)}`, amount: `${total % 60}` };
}
